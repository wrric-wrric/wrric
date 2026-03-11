import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Set, Optional
from collections import defaultdict
from dataclasses import dataclass
import numpy as np
from scipy.spatial.distance import cosine
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.dialects.postgresql import insert
import uuid

from models.db_models import Funder, Entity, MatchRecord, Notification, Message, Profile, Proposal
from utils.database import get_db, async_session

logger = logging.getLogger(__name__)

MATCH_INTERVAL_MINUTES = 360
SIMILARITY_THRESHOLD = 0.4
MAX_MATCHES_PER_FUNDER = 5
BATCH_SIZE = 100

WEIGHTS = {
    'semantic': 0.7,
    'thematic': 0.1,
    'region': 0.1,
    'funding': 0.1
}

NOTIFICATION_TEMPLATE = "New match suggested: {entity_name} with score {score:.2f}. Reason: {reason}"
MESSAGE_TEMPLATE = "Hello, our algorithm matched your interests with {entity_name}. Let's discuss collaboration!"
SYSTEM_PROFILE_ID = "00000000-0000-0000-0000-000000000001"

@dataclass
class MatchCandidate:
    funder_id: str
    entity_id: str
    score: float
    reason: str
    entity_name: str
    funder_name: str
    profile_id: Optional[uuid.UUID]
    point_of_contact: Optional[Dict]

class OptimizedMatchmaker:
    def __init__(self):
        self.funder_embeddings: Dict[str, np.ndarray] = {}
        self.entity_embeddings: Dict[str, np.ndarray] = {}
        self.existing_match_cache: Dict[Tuple[str, str], bool] = {}
        self.proposal_cache: Dict[str, Optional[Proposal]] = {}

    def extract_embedding(self, embeddings_dict: Optional[Dict]) -> Optional[np.ndarray]:
        if not embeddings_dict or not isinstance(embeddings_dict, dict) or 'embedding' not in embeddings_dict:
            return None
        try:
            return np.array(embeddings_dict['embedding'], dtype=np.float32)
        except (ValueError, TypeError):
            return None

    def compute_semantic_similarity(self, funder_vec: np.ndarray, entity_vec: np.ndarray) -> float:
        try:
            return 1 - cosine(funder_vec, entity_vec)
        except Exception:
            return 0.0

    def compute_thematic_overlap(self, funder_themes: List, entity_focus: List, entity_scopes: List) -> float:
        funder_set = set(funder_themes or [])
        entity_set = set((entity_focus or []) + (entity_scopes or []))
        if not funder_set:
            return 0.0
        overlap = len(funder_set & entity_set) / len(funder_set)
        return overlap

    def check_region_match(self, funder_regions: List, entity_location: Optional[Dict]) -> bool:
        if not funder_regions or not entity_location:
            return False
        entity_location_str = (
            entity_location.get('country', '') or 
            entity_location.get('city', '') or 
            entity_location.get('address', '')
        )
        if not entity_location_str:
            return False
        entity_location_str = entity_location_str.lower()
        return any(r.lower() in entity_location_str for r in funder_regions)

    def compute_match_score(
        self,
        funder: Funder,
        entity: Entity,
        proposal: Optional[Proposal]
    ) -> Tuple[float, str]:
        score = 0.0
        reason_parts = []

        funder_vec = self.extract_embedding(funder.embeddings)
        entity_vec = self.extract_embedding(entity.embeddings)

        if funder_vec is not None and entity_vec is not None:
            sim = self.compute_semantic_similarity(funder_vec, entity_vec)
            if sim > SIMILARITY_THRESHOLD:
                score += WEIGHTS['semantic'] * sim
                reason_parts.append(f"High semantic match ({sim:.2f})")
            else:
                reason_parts.append(f"Low semantic match ({sim:.2f})")
        else:
            reason_parts.append("No embeddings available")

        overlap = self.compute_thematic_overlap(
            funder.thematic_focus,
            entity.climate_tech_focus,
            entity.scopes
        )
        if overlap > 0.3:
            score += WEIGHTS['thematic'] * overlap
            common_themes = set(funder.thematic_focus or []) & set((entity.climate_tech_focus or []) + (entity.scopes or []))
            reason_parts.append(f"Thematic overlap: {', '.join(common_themes)}")

        if self.check_region_match(funder.regions, entity.location):
            score += WEIGHTS['region']
            reason_parts.append("Regional alignment")

        if funder.min_ticket and funder.max_ticket:
            if proposal and proposal.ask_amount:
                if funder.min_ticket <= proposal.ask_amount <= funder.max_ticket:
                    score += WEIGHTS['funding']
                    reason_parts.append(f"Funding match: ${proposal.ask_amount:,}")
                else:
                    reason_parts.append(f"Funding mismatch: ${proposal.ask_amount:,}")
            else:
                score += WEIGHTS['funding'] * 0.5
                reason_parts.append("Funding compatibility unknown")

        reason = '; '.join(reason_parts) if reason_parts else "Low match confidence"
        return score, reason

    async def batch_check_existing_matches(
        self,
        db: AsyncSession,
        funder_ids: List[str],
        entity_ids: List[str],
        days_back: int = 30
    ) -> Set[Tuple[str, str]]:
        cutoff_date = datetime.utcnow() - timedelta(days=days_back)
        
        query = select(MatchRecord.funder_id, MatchRecord.entity_id).where(
            and_(
                MatchRecord.funder_id.in_(funder_ids),
                MatchRecord.entity_id.in_(entity_ids),
                MatchRecord.created_at > cutoff_date
            )
        )
        
        result = await db.execute(query)
        existing_pairs = {(row[0], row[1]) for row in result.all()}
        
        return existing_pairs

    async def batch_load_proposals(
        self,
        db: AsyncSession,
        entity_ids: List[str]
    ) -> Dict[str, Proposal]:
        if not entity_ids:
            return {}
        
        query = select(Proposal).where(
            and_(
                Proposal.entity_id.in_(entity_ids),
                Proposal.status == "open"
            )
        )
        
        result = await db.execute(query)
        proposals = result.scalars().all()
        
        return {str(p.entity_id): p for p in proposals}

    async def batch_create_match_records(
        self,
        db: AsyncSession,
        matches: List[MatchCandidate]
    ) -> int:
        if not matches:
            return 0
        
        now = datetime.utcnow()
        
        match_records = [
            {
                'funder_id': match.funder_id,
                'entity_id': match.entity_id,
                'score': match.score,
                'reason': match.reason,
                'status': 'suggested',
                'created_at': now
            }
            for match in matches
        ]
        
        try:
            result = await db.execute(insert(MatchRecord).values(match_records))
            await db.commit()
            return result.rowcount
        except Exception as e:
            logger.error(f"Batch insert failed: {str(e)}")
            await db.rollback()
            return 0

    async def batch_create_notifications(
        self,
        db: AsyncSession,
        notifications: List[Dict]
    ) -> int:
        if not notifications:
            return 0
        
        try:
            result = await db.execute(insert(Notification).values(notifications))
            await db.commit()
            return result.rowcount
        except Exception as e:
            logger.error(f"Batch notification failed: {str(e)}")
            await db.rollback()
            return 0

    async def batch_create_messages(
        self,
        db: AsyncSession,
        messages: List[Dict]
    ) -> int:
        if not messages:
            return 0
        
        try:
            result = await db.execute(insert(Message).values(messages))
            await db.commit()
            return result.rowcount
        except Exception as e:
            logger.error(f"Batch message failed: {str(e)}")
            await db.rollback()
            return 0

    async def process_funder_batch(
        self,
        db: AsyncSession,
        funders: List[Funder],
        entities: List[Entity],
        proposals: Dict[str, Proposal],
        existing_matches: Set[Tuple[str, str]]
    ) -> List[MatchCandidate]:
        all_candidates = []
        
        for funder in funders:
            funder_id = str(funder.id)
            funder_matches = []
            
            for entity in entities:
                entity_id = str(entity.id)
                
                if (funder_id, entity_id) in existing_matches:
                    continue
                
                proposal = proposals.get(entity_id)
                score, reason = self.compute_match_score(funder, entity, proposal)
                
                if score > SIMILARITY_THRESHOLD:
                    funder_matches.append((score, reason, entity))
            
            funder_matches.sort(key=lambda x: x[0], reverse=True)
            
            for score, reason, entity in funder_matches[:MAX_MATCHES_PER_FUNDER]:
                candidate = MatchCandidate(
                    funder_id=funder_id,
                    entity_id=str(entity.id),
                    score=score,
                    reason=reason,
                    entity_name=entity.university or entity.department.get('name', ''),
                    funder_name=funder.name,
                    profile_id=funder.profile_id,
                    point_of_contact=entity.point_of_contact
                )
                all_candidates.append(candidate)
        
        return all_candidates

    async def run_matchmaking(self, db: AsyncSession) -> Dict:
        start_time = datetime.utcnow()
        stats = {
            'funders_processed': 0,
            'entities_processed': 0,
            'matches_created': 0,
            'notifications_created': 0,
            'messages_created': 0,
            'duration_seconds': 0,
            'error': None
        }
        
        try:
            funder_result = await db.execute(
                select(Funder).where(Funder.verified == True)
            )
            funders = funder_result.scalars().all()
            stats['funders_processed'] = len(funders)
            
            entity_result = await db.execute(
                select(Entity).where(Entity.entity_type == 'lab')
            )
            entities = entity_result.scalars().all()
            stats['entities_processed'] = len(entities)
            
            if not funders or not entities:
                logger.warning("No funders or entities found for matchmaking")
                return stats
            
            funder_ids = [str(f.id) for f in funders]
            entity_ids = [str(e.id) for e in entities]
            
            logger.info(f"Loading {len(funder_ids)} funder IDs and {len(entity_ids)} entity IDs")
            
            existing_matches = await self.batch_check_existing_matches(
                db, funder_ids, entity_ids, days_back=30
            )
            logger.info(f"Found {len(existing_matches)} existing recent matches")
            
            proposals = await self.batch_load_proposals(db, entity_ids)
            logger.info(f"Loaded {len(proposals)} open proposals")
            
            all_candidates = []
            
            for i in range(0, len(funders), BATCH_SIZE):
                funder_batch = funders[i:i+BATCH_SIZE]
                batch_candidates = await self.process_funder_batch(
                    db, funder_batch, entities, proposals, existing_matches
                )
                all_candidates.extend(batch_candidates)
                logger.info(f"Processed batch {i//BATCH_SIZE + 1}: {len(batch_candidates)} candidates")
            
            logger.info(f"Total candidates before filtering: {len(all_candidates)}")
            
            if all_candidates:
                matches_created = await self.batch_create_match_records(db, all_candidates)
                stats['matches_created'] = matches_created
                logger.info(f"Created {matches_created} match records")
                
                notifications = []
                messages = []
                
                profile_ids = [c.profile_id for c in all_candidates if c.profile_id]
                if profile_ids:
                    profile_result = await db.execute(
                        select(Profile).where(Profile.id.in_(profile_ids))
                    )
                    profiles = {str(p.id): p for p in profile_result.scalars().all()}
                    
                    for candidate in all_candidates:
                        if candidate.profile_id and str(candidate.profile_id) in profiles:
                            profile = profiles[str(candidate.profile_id)]
                            if profile.user_id:
                                notifications.append({
                                    'user_id': str(profile.user_id),
                                    'type': 'match_suggested',
                                    'content': NOTIFICATION_TEMPLATE.format(
                                        entity_name=candidate.entity_name,
                                        score=candidate.score,
                                        reason=candidate.reason
                                    ),
                                    'related_id': str(uuid.uuid4()),
                                    'is_read': False
                                })
                        
                        if candidate.point_of_contact and candidate.point_of_contact.get('profile_id'):
                            try:
                                receiver_profile_id = str(uuid.UUID(candidate.point_of_contact['profile_id']))
                                messages.append({
                                    'sender_profile_id': SYSTEM_PROFILE_ID,
                                    'receiver_profile_id': receiver_profile_id,
                                    'content': MESSAGE_TEMPLATE.format(entity_name=candidate.entity_name),
                                    'message_type': 'text',
                                    'is_read': False,
                                    'is_delivered': False
                                })
                            except (ValueError, AttributeError):
                                pass
                
                if notifications:
                    stats['notifications_created'] = await self.batch_create_notifications(db, notifications)
                    logger.info(f"Created {stats['notifications_created']} notifications")
                
                if messages:
                    stats['messages_created'] = await self.batch_create_messages(db, messages)
                    logger.info(f"Created {stats['messages_created']} messages")
            
            stats['duration_seconds'] = (datetime.utcnow() - start_time).total_seconds()
            logger.info(f"Matchmaking complete: {stats}")
            
            return stats
            
        except Exception as e:
            stats['error'] = str(e)
            logger.exception(f"Matchmaking failed: {str(e)}")
            await db.rollback()
            return stats

_matchmaker_instance: Optional[OptimizedMatchmaker] = None

def get_matchmaker() -> OptimizedMatchmaker:
    global _matchmaker_instance
    if _matchmaker_instance is None:
        _matchmaker_instance = OptimizedMatchmaker()
    return _matchmaker_instance

async def run_matchmaking_wrapper():
    async with async_session() as db:
        matchmaker = get_matchmaker()
        stats = await matchmaker.run_matchmaking(db)
        logger.info(f"Matchmaking wrapper completed: {stats}")

async def start_matchmaker():
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        run_matchmaking_wrapper,
        'interval',
        minutes=MATCH_INTERVAL_MINUTES
    )
    scheduler.start()
    logger.info(f"Optimized matchmaker started with interval {MATCH_INTERVAL_MINUTES} minutes")
    return scheduler

async def shutdown_matchmaker(scheduler):
    if scheduler:
        scheduler.shutdown()
        logger.info("Optimized matchmaker scheduler shut down")

async def trigger_matchmaking_now():
    async with async_session() as db:
        matchmaker = get_matchmaker()
        return await matchmaker.run_matchmaking(db)