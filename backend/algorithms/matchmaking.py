import asyncio
import logging
from datetime import datetime, timedelta
from typing import List
import numpy as np
from scipy.spatial.distance import cosine
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
import uuid

from models.db_models import Funder, Entity, MatchRecord, Notification, Message, Profile, Proposal
from utils.database import get_db, create_match_record, create_message, async_session
from utils.embeddings import generate_embeddings, generate_funder_embeddings
from utils.database import create_notification

logger = logging.getLogger(__name__)

# Configurable constants
MATCH_INTERVAL_MINUTES = 3600
SIMILARITY_THRESHOLD = 0.4
MAX_MATCHES_PER_FUNDER = 5
WEIGHTS = {
    'semantic': 0.7,
    'thematic': 0.1,
    'region': 0.1,
    'funding': 0.1
}
NOTIFICATION_TEMPLATE = "New match suggested: {entity_name} with score {score:.2f}. Reason: {reason}"
MESSAGE_TEMPLATE = "Hello, our algorithm matched your interests with {entity_name}. Let's discuss collaboration!"
SYSTEM_PROFILE_ID = "00000000-0000-0000-0000-000000000001"  # Replace with actual system profile UUID

async def compute_match_score(funder: Funder, entity: Entity, db: AsyncSession) -> tuple[float, str]:
    """Compute hybrid match score between funder and entity."""
    funder_id = str(funder.id)
    entity_id = str(entity.id)
    logger.debug(f"Computing match score for funder {funder_id} and entity {entity_id}")

    score = 0.0
    reason_parts = []

    # Semantic similarity (embeddings)
    if funder.embeddings is not None and isinstance(funder.embeddings, dict) and 'embedding' in funder.embeddings and \
       entity.embeddings is not None and isinstance(entity.embeddings, dict) and 'embedding' in entity.embeddings:
        logger.debug(f"Embeddings found for funder {funder_id} and entity {entity_id}")
        try:
            funder_vec = np.array(funder.embeddings['embedding'])
            entity_vec = np.array(entity.embeddings['embedding'])
            sim = 1 - cosine(funder_vec, entity_vec)
            logger.debug(f"Semantic similarity: {sim:.2f}")
            if sim > SIMILARITY_THRESHOLD:
                score += WEIGHTS['semantic'] * sim
                reason_parts.append(f"High semantic match ({sim:.2f}) on research and focus areas")
            else:
                reason_parts.append(f"Low semantic match ({sim:.2f})")
        except Exception as e:
            logger.warning(f"Error computing embedding similarity for funder {funder_id}, entity {entity_id}: {str(e)}")
            reason_parts.append("Embedding similarity computation failed")
    else:
        logger.warning(f"Missing or invalid embeddings for funder {funder_id} or entity {entity_id}")
        reason_parts.append("No embeddings available")

    # Thematic overlap (keyword match)
    funder_themes = set(funder.thematic_focus or [])
    entity_focus = set(entity.climate_tech_focus or []) | set(entity.scopes or [])
    overlap = len(funder_themes & entity_focus) / len(funder_themes) if funder_themes else 0
    logger.debug(f"Thematic overlap: {overlap:.2f} (common themes: {', '.join(funder_themes & entity_focus)})")
    if overlap > 0.3:
        score += WEIGHTS['thematic'] * overlap
        reason_parts.append(f"Thematic overlap: {', '.join(funder_themes & entity_focus)}")

    # Region match
    funder_regions = set(funder.regions or [])
    entity_location = entity.location.get('country', '') or entity.location.get('city', '') if entity.location else ''
    logger.debug(f"Checking region match: funder regions {funder_regions}, entity location '{entity_location}'")
    if entity_location and any(r.lower() in entity_location.lower() for r in funder_regions):
        score += WEIGHTS['region']
        reason_parts.append("Regional alignment")

    # Funding alignment (check Proposal.ask_amount)
    if funder.min_ticket and funder.max_ticket:
        proposal_result = await db.execute(
            select(Proposal).where(Proposal.entity_id == entity.id, Proposal.status == "open")
        )
        proposal = proposal_result.scalars().first()
        if proposal and proposal.ask_amount:
            logger.debug(f"Found open proposal for entity {entity_id}: ask_amount {proposal.ask_amount}")
            if funder.min_ticket <= proposal.ask_amount <= funder.max_ticket:
                score += WEIGHTS['funding']
                reason_parts.append(f"Funding match: {proposal.ask_amount} within {funder.min_ticket}-{funder.max_ticket}")
            else:
                reason_parts.append(f"Funding mismatch: {proposal.ask_amount} outside {funder.min_ticket}-{funder.max_ticket}")
        else:
            logger.debug(f"No open proposal found for entity {entity_id}")
            score += WEIGHTS['funding'] * 0.5
            reason_parts.append("Funding compatibility unknown")

    reason = '; '.join(reason_parts) if reason_parts else "Low match confidence"
    logger.debug(f"Final score for funder {funder_id}, entity {entity_id}: {score:.2f} (reason: {reason})")
    return score, reason

async def run_matchmaking(db: AsyncSession):
    """Core matchmaking loop: Fetch, match, record, notify, message."""
    logger.info("Starting matchmaking run")
    try:
        # Fetch all active funders and entities
        funder_result = await db.execute(select(Funder).where(Funder.verified == True))
        funders: List[Funder] = funder_result.scalars().all()
        logger.info(f"Fetched {len(funders)} verified funders")

        entity_result = await db.execute(select(Entity).where(Entity.entity_type == 'lab'))
        entities: List[Entity] = entity_result.scalars().all()
        logger.info(f"Fetched {len(entities)} lab entities")

        if not funders or not entities:
            logger.warning(f"No {'funders' if not funders else 'entities'} found for matchmaking")
            return

        new_matches = 0
        for funder in funders:
            funder_id = str(funder.id)
            logger.debug(f"Processing funder {funder_id} ({funder.name})")
            matches = []
            for entity in entities:
                entity_id = str(entity.id)
                logger.debug(f"Checking entity {entity_id} ({entity.university or entity.department.get('name', '')})")

                # Skip recent matches (within 30 days)
                existing_match_result = await db.execute(
                    select(MatchRecord).where(
                        MatchRecord.funder_id == funder.id,
                        MatchRecord.entity_id == entity.id,
                        MatchRecord.created_at > datetime.utcnow() - timedelta(days=30)
                    )
                )
                if existing_match_result.scalars().first():
                    logger.debug(f"Skipping existing recent match for funder {funder_id}, entity {entity_id}")
                    continue

                score, reason = await compute_match_score(funder, entity, db)
                if score > SIMILARITY_THRESHOLD:
                    logger.debug(f"High score match: {score:.2f} - adding to matches list")
                    matches.append((score, reason, entity))
                else:
                    logger.debug(f"Low score: {score:.2f} - not adding")

            # Sort and limit top matches
            matches.sort(key=lambda x: x[0], reverse=True)
            logger.debug(f"Top {min(MAX_MATCHES_PER_FUNDER, len(matches))} matches for funder {funder_id}")
            for idx, (score, reason, entity) in enumerate(matches[:MAX_MATCHES_PER_FUNDER], 1):
                entity_id = str(entity.id)
                logger.debug(f"Processing top match {idx}: score {score:.2f}, entity {entity_id}, reason '{reason}'")

                # Create match record
                match_data = {
                    'funder_id': funder_id,
                    'entity_id': entity_id,
                    'score': score,
                    'reason': reason,
                    'status': 'suggested'
                }
                match_record = await create_match_record(db, **match_data)
                if not match_record:
                    logger.warning(f"Failed to create match record for funder {funder_id}, entity {entity_id}")
                    continue

                match_record_id = str(match_record.id)
                logger.info(f"Created match record {match_record_id} for funder {funder_id}, entity {entity_id}")
                new_matches += 1

                # Send notification to funder user (if linked to profile)
                if funder.profile_id:
                    profile_result = await db.execute(select(Profile).where(Profile.id == funder.profile_id))
                    profile = profile_result.scalars().first()
                    if profile and profile.user_id:
                        user_id = str(profile.user_id)
                        notification_content = NOTIFICATION_TEMPLATE.format(
                            entity_name=entity.university or entity.department.get('name', ''),
                            score=score,
                            reason=reason
                        )
                        notification_data = {
                            'user_id': user_id,
                            'type': 'match_suggested',
                            'content': notification_content,
                            'related_id': match_record_id
                        }
                        notification = await create_notification(db, **notification_data)
                        if notification:
                            logger.debug(f"Created notification for user {user_id}: '{notification_content}'")
                        else:
                            logger.warning(f"Failed to create notification for user {user_id}")
                    else:
                        logger.debug(f"No user linked to profile {funder.profile_id} for funder {funder_id}")

                # Send automated message (if point_of_contact exists)
                if entity.point_of_contact and entity.point_of_contact.get('profile_id'):
                    try:
                        receiver_profile_id = str(uuid.UUID(entity.point_of_contact['profile_id']))
                        message_content = MESSAGE_TEMPLATE.format(
                            entity_name=entity.university or entity.department.get('name', '')
                        )
                        message_data = {
                            'sender_profile_id': SYSTEM_PROFILE_ID,
                            'receiver_profile_id': receiver_profile_id,
                            'content': message_content
                        }
                        message = await create_message(db, **message_data)
                        if message:
                            logger.debug(f"Created message to receiver {receiver_profile_id}: '{message_content}'")
                        else:
                            logger.warning(f"Failed to create message for receiver {receiver_profile_id}")
                    except ValueError:
                        logger.warning(f"Invalid profile_id {entity.point_of_contact['profile_id']} for entity {entity_id}")
                    except Exception as e:
                        logger.warning(f"Error sending message for entity {entity_id}: {str(e)}")

        await db.commit()
        logger.info(f"Matchmaking run complete: {new_matches} new matches created")
    except Exception as e:
        logger.exception(f"Matchmaking run failed: {str(e)}")
        await db.rollback()
        raise

async def start_matchmaker():
    """Start the scheduler in background."""
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        run_matchmaking_wrapper,
        'interval',
        minutes=MATCH_INTERVAL_MINUTES
    )
    scheduler.start()
    logger.info(f"Matchmaker started with interval {MATCH_INTERVAL_MINUTES} minutes")
    return scheduler

async def shutdown_matchmaker(scheduler):
    """Shutdown the scheduler cleanly."""
    if scheduler:
        scheduler.shutdown()
        logger.info("Matchmaker scheduler shut down")

async def run_matchmaking_wrapper():
    """Wrapper to create a fresh DB session for each scheduled run."""
    async with async_session() as db:
        await run_matchmaking(db)