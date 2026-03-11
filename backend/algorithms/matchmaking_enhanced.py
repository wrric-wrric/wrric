import asyncio
import logging
import math
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Set, Optional
from collections import defaultdict, Counter
from dataclasses import dataclass, field
import numpy as np
from scipy.spatial.distance import cosine, pdist, squareform
from scipy.sparse import csr_matrix
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select, and_, or_, func
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

BASE_WEIGHTS = {
    'semantic': 0.35,
    'thematic': 0.10,
    'region': 0.05,
    'funding': 0.05,
    'markov': 0.15,
    'collaborative': 0.10,
    'success_rate': 0.10,
    'diversity': 0.05,
    'centrality': 0.05
}

NOTIFICATION_TEMPLATE = "New match suggested: {entity_name} with score {score:.2f}. Reason: {reason}"
MESSAGE_TEMPLATE = "Hello, our algorithm matched your interests with {entity_name}. Let's discuss collaboration!"
SYSTEM_PROFILE_ID = "00000000-0000-0000-0000-000000000001"

TEMPORAL_DECAY_DAYS = 90
DECAY_LAMBDA = 0.1

DIVERSITY_WINDOW = 3

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
    component_scores: Dict[str, float] = field(default_factory=dict)

@dataclass
class MarkovTransition:
    from_theme: str
    to_theme: str
    count: int
    probability: float

@dataclass
class FunderProfile:
    funder_id: str
    total_matches: int
    successful_matches: int
    success_rate: float
    recent_matches: List[str]
    theme_history: List[str]
    centrality_score: float

class MarkovChainModel:
    def __init__(self):
        self.transition_matrix: Dict[Tuple[str, str], float] = {}
        self.theme_counts: Dict[str, int] = {}
        self.theme_probabilities: Dict[str, float] = {}

    def train(self, matches: List[Dict]):
        for match in matches:
            themes = match.get('funder_themes', [])
            entity_themes = match.get('entity_themes', [])
            
            if not themes or not entity_themes:
                continue
            
            for i in range(len(themes) - 1):
                from_theme = themes[i]
                to_theme = themes[i + 1]
                key = (from_theme, to_theme)
                self.transition_matrix[key] = self.transition_matrix.get(key, 0) + 1
                self.theme_counts[from_theme] = self.theme_counts.get(from_theme, 0) + 1

            for theme in themes:
                for entity_theme in entity_themes:
                    key = (theme, entity_theme)
                    self.transition_matrix[key] = self.transition_matrix.get(key, 0) + 1
                    self.theme_counts[theme] = self.theme_counts.get(theme, 0) + 1

        total = sum(self.theme_counts.values())
        for theme, count in self.theme_counts.items():
            self.theme_probabilities[theme] = count / total if total > 0 else 0

        for key in self.transition_matrix:
            from_theme = key[0]
            self.transition_matrix[key] /= self.theme_counts.get(from_theme, 1)

    def predict_next_theme(self, current_themes: List[str], entity_themes: List[str]) -> float:
        if not current_themes or not self.transition_matrix:
            return 0.0

        max_prob = 0.0
        for theme in current_themes:
            for entity_theme in entity_themes:
                prob = self.transition_matrix.get((theme, entity_theme), 0.0)
                max_prob = max(max_prob, prob)

        return max_prob

class CollaborativeFiltering:
    def __init__(self):
        self.item_similarity: Dict[str, Dict[str, float]] = {}
        self.funder_history: Dict[str, List[str]] = defaultdict(list)

    def train(self, matches: List[Dict]):
        entity_funders = defaultdict(set)
        funder_entities = defaultdict(set)

        for match in matches:
            funder_id = match.get('funder_id')
            entity_id = match.get('entity_id')
            if funder_id and entity_id:
                entity_funders[entity_id].add(funder_id)
                funder_entities[funder_id].add(entity_id)
                self.funder_history[funder_id].append(entity_id)

        for entity_id, funders in entity_funders.items():
            for other_entity_id, other_funders in entity_funders.items():
                if entity_id == other_entity_id:
                    continue

                intersection = len(funders & other_funders)
                if intersection > 0:
                    jaccard = intersection / len(funders | other_funders)
                    self.item_similarity.setdefault(entity_id, {})[other_entity_id] = jaccard

    def get_similar_entities(self, entity_id: str, k: int = 5) -> List[Tuple[str, float]]:
        similar = self.item_similarity.get(entity_id, {})
        return sorted(similar.items(), key=lambda x: x[1], reverse=True)[:k]

    def predict_funder_score(self, funder_id: str, entity_id: str) -> float:
        if funder_id not in self.funder_history or entity_id not in self.item_similarity:
            return 0.0

        funder_entities = set(self.funder_history[funder_id])
        similar_entities = self.get_similar_entities(entity_id, k=10)

        score = 0.0
        total_weight = 0.0

        for similar_entity, similarity in similar_entities:
            if similar_entity in funder_entities:
                score += similarity
                total_weight += similarity

        return score / total_weight if total_weight > 0 else 0.0

class GaleShapleyMatcher:
    def __init__(self):
        pass

    def stable_match(
        self,
        funder_preferences: Dict[str, List[Tuple[str, float]]],
        entity_preferences: Dict[str, List[Tuple[str, float]]]
    ) -> Dict[str, str]:
        funder_free = set(funder_preferences.keys())
        entity_matches = {}
        funder_matches = {}

        while funder_free:
            funder = funder_free.pop()

            if not funder_preferences[funder]:
                continue

            entity, _ = funder_preferences[funder].pop(0)

            if entity not in entity_matches:
                entity_matches[entity] = funder
                funder_matches[funder] = entity
            else:
                current_funder = entity_matches[entity]
                
                entity_prefs = entity_preferences.get(entity, [])
                entity_rank = {e: i for i, (e, _) in enumerate(entity_prefs)}
                
                if entity_rank.get(funder, float('inf')) < entity_rank.get(current_funder, float('inf')):
                    funder_matches.pop(current_funder, None)
                    funder_free.add(current_funder)
                    entity_matches[entity] = funder
                    funder_matches[funder] = entity
                else:
                    funder_free.add(funder)

        return funder_matches

class EnhancedMatchmaker:
    def __init__(self):
        self.funder_embeddings: Dict[str, np.ndarray] = {}
        self.entity_embeddings: Dict[str, np.ndarray] = {}
        self.existing_match_cache: Dict[Tuple[str, str], bool] = {}
        self.proposal_cache: Dict[str, Optional[Proposal]] = {}
        
        self.markov_model = MarkovChainModel()
        self.cf_model = CollaborativeFiltering()
        self.gale_shapley = GaleShapleyMatcher()
        
        self.funder_profiles: Dict[str, FunderProfile] = {}
        self.entity_centralities: Dict[str, float] = {}
        self.match_history: List[Dict] = []
        
        self.last_train_time: Optional[datetime] = None

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

    def compute_temporal_decay(self, match_date: datetime) -> float:
        days_ago = (datetime.utcnow() - match_date).days
        if days_ago > TEMPORAL_DECAY_DAYS:
            return 0.0
        return math.exp(-DECAY_LAMBDA * days_ago)

    async def build_match_history(self, db: AsyncSession) -> List[Dict]:
        cutoff_date = datetime.utcnow() - timedelta(days=365)
        
        query = select(MatchRecord).where(
            and_(
                MatchRecord.created_at > cutoff_date,
                MatchRecord.status.in_(['suggested', 'accepted', 'completed'])
            )
        )
        
        result = await db.execute(query)
        records = result.scalars().all()
        
        history = []
        for record in records:
            history.append({
                'funder_id': str(record.funder_id),
                'entity_id': str(record.entity_id),
                'score': record.score,
                'status': record.status,
                'created_at': record.created_at
            })
        
        return history

    async def build_funder_profiles(
        self,
        db: AsyncSession,
        match_history: List[Dict],
        funders: List[Funder]
    ) -> Dict[str, FunderProfile]:
        profiles = {}
        
        for funder in funders:
            funder_id = str(funder.id)
            funder_matches = [m for m in match_history if m['funder_id'] == funder_id]
            
            total_matches = len(funder_matches)
            successful_matches = len([m for m in funder_matches if m['status'] in ['accepted', 'completed']])
            success_rate = successful_matches / total_matches if total_matches > 0 else 0.5
            
            recent_matches = [m['entity_id'] for m in funder_matches[:DIVERSITY_WINDOW]]
            theme_history = []
            
            for match in funder_matches:
                if match.get('funder_themes'):
                    theme_history.extend(match['funder_themes'])
            
            profiles[funder_id] = FunderProfile(
                funder_id=funder_id,
                total_matches=total_matches,
                successful_matches=successful_matches,
                success_rate=success_rate,
                recent_matches=recent_matches,
                theme_history=theme_history,
                centrality_score=0.0
            )
        
        return profiles

    def compute_graph_centrality(
        self,
        match_history: List[Dict],
        funders: List[Funder],
        entities: List[Entity]
    ) -> Dict[str, float]:
        funder_ids = {str(f.id) for f in funders}
        entity_ids = {str(e.id) for e in entities}
        
        edges = []
        for match in match_history:
            funder_id = match['funder_id']
            entity_id = match['entity_id']
            if funder_id in funder_ids and entity_id in entity_ids:
                edges.append((funder_id, entity_id, match['score']))
        
        if not edges:
            return {f_id: 0.5 for f_id in funder_ids}
        
        node_degree = defaultdict(int)
        node_weighted_degree = defaultdict(float)
        
        for f_id, e_id, score in edges:
            node_degree[f_id] += 1
            node_degree[e_id] += 1
            node_weighted_degree[f_id] += score
            node_weighted_degree[e_id] += score
        
        max_degree = max(node_degree.values()) if node_degree else 1
        max_weighted_degree = max(node_weighted_degree.values()) if node_weighted_degree else 1
        
        centrality_scores = {}
        
        for f in funders:
            f_id = str(f.id)
            degree_score = node_degree.get(f_id, 0) / max_degree
            weighted_score = node_weighted_degree.get(f_id, 0) / max_weighted_degree
            centrality_scores[f_id] = (degree_score + weighted_score) / 2
        
        return centrality_scores

    def compute_diversity_score(
        self,
        funder_profile: FunderProfile,
        entity_id: str,
        entity_themes: List[str]
    ) -> float:
        if not funder_profile.recent_matches:
            return 1.0
        
        if entity_id in funder_profile.recent_matches:
            return 0.0
        
        if not entity_themes or not funder_profile.theme_history:
            return 0.5
        
        recent_themes = set(funder_profile.theme_history[-10:])
        entity_theme_set = set(entity_themes)
        
        overlap = len(recent_themes & entity_theme_set) / len(recent_themes) if recent_themes else 0
        return 1.0 - overlap

    def compute_markov_score(
        self,
        funder_themes: List[str],
        entity_themes: List[str]
    ) -> float:
        return self.markov_model.predict_next_theme(funder_themes, entity_themes)

    def compute_collaborative_score(
        self,
        funder_id: str,
        entity_id: str
    ) -> float:
        return self.cf_model.predict_funder_score(funder_id, entity_id)

    def compute_match_score(
        self,
        funder: Funder,
        entity: Entity,
        proposal: Optional[Proposal],
        funder_profile: Optional[FunderProfile],
        entity_themes: List[str]
    ) -> Tuple[float, str, Dict[str, float]]:
        score = 0.0
        reason_parts = []
        component_scores = {}

        funder_vec = self.extract_embedding(funder.embeddings)
        entity_vec = self.extract_embedding(entity.embeddings)

        if funder_vec is not None and entity_vec is not None:
            sim = self.compute_semantic_similarity(funder_vec, entity_vec)
            component_scores['semantic'] = sim
            if sim > SIMILARITY_THRESHOLD:
                score += BASE_WEIGHTS['semantic'] * sim
                reason_parts.append(f"High semantic match ({sim:.2f})")
            else:
                reason_parts.append(f"Low semantic match ({sim:.2f})")
        else:
            component_scores['semantic'] = 0.0
            reason_parts.append("No embeddings available")

        overlap = self.compute_thematic_overlap(
            funder.thematic_focus,
            entity.climate_tech_focus,
            entity.scopes
        )
        component_scores['thematic'] = overlap
        if overlap > 0.3:
            score += BASE_WEIGHTS['thematic'] * overlap
            common_themes = set(funder.thematic_focus or []) & set((entity.climate_tech_focus or []) + (entity.scopes or []))
            reason_parts.append(f"Thematic overlap: {', '.join(common_themes)}")

        if self.check_region_match(funder.regions, entity.location):
            score += BASE_WEIGHTS['region']
            reason_parts.append("Regional alignment")
        component_scores['region'] = 1.0 if self.check_region_match(funder.regions, entity.location) else 0.0

        funding_match = 0.0
        if funder.min_ticket and funder.max_ticket:
            if proposal and proposal.ask_amount:
                if funder.min_ticket <= proposal.ask_amount <= funder.max_ticket:
                    score += BASE_WEIGHTS['funding']
                    reason_parts.append(f"Funding match: ${proposal.ask_amount:,}")
                    funding_match = 1.0
                else:
                    reason_parts.append(f"Funding mismatch: ${proposal.ask_amount:,}")
                    funding_match = 0.0
            else:
                score += BASE_WEIGHTS['funding'] * 0.5
                reason_parts.append("Funding compatibility unknown")
                funding_match = 0.5
        component_scores['funding'] = funding_match

        if funder_profile:
            markov_score = self.compute_markov_score(funder.thematic_focus or [], entity_themes)
            component_scores['markov'] = markov_score
            score += BASE_WEIGHTS['markov'] * markov_score
            if markov_score > 0.1:
                reason_parts.append(f"Markov prediction ({markov_score:.2f})")

            cf_score = self.compute_collaborative_score(funder_profile.funder_id, str(entity.id))
            component_scores['collaborative'] = cf_score
            score += BASE_WEIGHTS['collaborative'] * cf_score
            if cf_score > 0.1:
                reason_parts.append(f"Collaborative filter ({cf_score:.2f})")

            success_boost = funder_profile.success_rate
            component_scores['success_rate'] = success_boost
            score += BASE_WEIGHTS['success_rate'] * success_boost
            reason_parts.append(f"Success rate ({success_boost:.2%})")

            diversity_score = self.compute_diversity_score(funder_profile, str(entity.id), entity_themes)
            component_scores['diversity'] = diversity_score
            score += BASE_WEIGHTS['diversity'] * diversity_score
            if diversity_score < 0.3:
                reason_parts.append(f"Low diversity ({diversity_score:.2f})")

            centrality_score = self.entity_centralities.get(str(entity.id), 0.5)
            component_scores['centrality'] = centrality_score
            score += BASE_WEIGHTS['centrality'] * centrality_score
            if centrality_score > 0.6:
                reason_parts.append(f"High centrality ({centrality_score:.2f})")

        reason = '; '.join(reason_parts) if reason_parts else "Low match confidence"
        return score, reason, component_scores

    async def train_models(self, db: AsyncSession):
        logger.info("Training advanced matching models...")
        
        match_history = await self.build_match_history(db)
        self.match_history = match_history
        logger.info(f"Loaded {len(match_history)} historical matches for training")

        augmented_history = []
        for match in match_history:
            augmented = match.copy()
            augmented_history.append(augmented)

        self.markov_model.train(augmented_history)
        logger.info("Markov chain model trained")

        self.cf_model.train(augmented_history)
        logger.info("Collaborative filtering model trained")

        self.last_train_time = datetime.utcnow()
        logger.info("Model training completed")

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

    async def apply_stable_matching(
        self,
        candidates: List[MatchCandidate],
        max_per_funder: int = MAX_MATCHES_PER_FUNDER
    ) -> List[MatchCandidate]:
        funder_preferences: Dict[str, List[Tuple[str, float]]] = defaultdict(list)
        entity_preferences: Dict[str, List[Tuple[str, float]]] = defaultdict(list)

        for candidate in candidates:
            funder_preferences[candidate.funder_id].append((candidate.entity_id, candidate.score))
            entity_preferences[candidate.entity_id].append((candidate.funder_id, candidate.score))

        for funder_id in funder_preferences:
            funder_preferences[funder_id].sort(key=lambda x: x[1], reverse=True)

        for entity_id in entity_preferences:
            entity_preferences[entity_id].sort(key=lambda x: x[1], reverse=True)

        stable_matches = self.gale_shapley.stable_match(funder_preferences, entity_preferences)

        stable_candidates = []
        for funder_id, entity_id in stable_matches.items():
            for candidate in candidates:
                if candidate.funder_id == funder_id and candidate.entity_id == entity_id:
                    stable_candidates.append(candidate)
                    break

        additional_candidates = []
        for candidate in candidates:
            if (candidate.funder_id, candidate.entity_id) not in stable_matches.items():
                funder_matches = [c for c in stable_candidates if c.funder_id == candidate.funder_id]
                if len(funder_matches) < max_per_funder:
                    additional_candidates.append(candidate)

        stable_candidates.extend(additional_candidates[:max_per_funder * len(set(c.funder_id for c in stable_candidates))])

        return stable_candidates

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
            funder_profile = self.funder_profiles.get(funder_id)
            funder_matches = []
            
            for entity in entities:
                entity_id = str(entity.id)
                
                if (funder_id, entity_id) in existing_matches:
                    continue
                
                proposal = proposals.get(entity_id)
                entity_themes = (entity.climate_tech_focus or []) + (entity.scopes or [])
                score, reason, component_scores = self.compute_match_score(
                    funder, entity, proposal, funder_profile, entity_themes
                )
                
                if score > SIMILARITY_THRESHOLD:
                    funder_matches.append((score, reason, entity, component_scores))
            
            funder_matches.sort(key=lambda x: x[0], reverse=True)
            
            for score, reason, entity, component_scores in funder_matches[:MAX_MATCHES_PER_FUNDER * 2]:
                candidate = MatchCandidate(
                    funder_id=funder_id,
                    entity_id=str(entity.id),
                    score=score,
                    reason=reason,
                    entity_name=entity.university or entity.department.get('name', ''),
                    funder_name=funder.name,
                    profile_id=funder.profile_id,
                    point_of_contact=entity.point_of_contact,
                    component_scores=component_scores
                )
                all_candidates.append(candidate)
        
        stable_candidates = await self.apply_stable_matching(all_candidates)
        
        final_candidates = []
        for funder in funders:
            funder_id = str(funder.id)
            funder_candidates = [c for c in stable_candidates if c.funder_id == funder_id]
            funder_candidates.sort(key=lambda x: x.score, reverse=True)
            final_candidates.extend(funder_candidates[:MAX_MATCHES_PER_FUNDER])
        
        return final_candidates

    async def run_matchmaking(self, db: AsyncSession) -> Dict:
        start_time = datetime.utcnow()
        stats = {
            'funders_processed': 0,
            'entities_processed': 0,
            'matches_created': 0,
            'notifications_created': 0,
            'messages_created': 0,
            'duration_seconds': 0,
            'error': None,
            'model_training_time': 0,
            'stable_matching': True
        }
        
        try:
            training_start = datetime.utcnow()
            await self.train_models(db)
            stats['model_training_time'] = (datetime.utcnow() - training_start).total_seconds()
            
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
            
            match_history = await self.build_match_history(db)
            self.funder_profiles = await self.build_funder_profiles(db, match_history, funders)
            self.entity_centralities = self.compute_graph_centrality(match_history, funders, entities)
            
            funder_ids = [str(f.id) for f in funders]
            entity_ids = [str(e.id) for e in entities]
            
            logger.info(f"Processing {len(funder_ids)} funders and {len(entity_ids)} entities")
            
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
            
            logger.info(f"Total candidates after stable matching: {len(all_candidates)}")
            
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
            logger.info(f"Enhanced matchmaking complete: {stats}")
            
            return stats
            
        except Exception as e:
            stats['error'] = str(e)
            logger.exception(f"Enhanced matchmaking failed: {str(e)}")
            await db.rollback()
            return stats

_matchmaker_instance: Optional[EnhancedMatchmaker] = None

def get_matchmaker() -> EnhancedMatchmaker:
    global _matchmaker_instance
    if _matchmaker_instance is None:
        _matchmaker_instance = EnhancedMatchmaker()
    return _matchmaker_instance

async def run_matchmaking_wrapper():
    async with async_session() as db:
        matchmaker = get_matchmaker()
        stats = await matchmaker.run_matchmaking(db)
        logger.info(f"Enhanced matchmaking wrapper completed: {stats}")

async def start_matchmaker():
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        run_matchmaking_wrapper,
        'interval',
        minutes=MATCH_INTERVAL_MINUTES
    )
    scheduler.start()
    logger.info(f"Enhanced matchmaker started with interval {MATCH_INTERVAL_MINUTES} minutes")
    return scheduler

async def shutdown_matchmaker(scheduler):
    if scheduler:
        scheduler.shutdown()
        logger.info("Enhanced matchmaker scheduler shut down")

async def trigger_matchmaking_now():
    async with async_session() as db:
        matchmaker = get_matchmaker()
        return await matchmaker.run_matchmaking(db)
