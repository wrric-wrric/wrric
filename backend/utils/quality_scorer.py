"""Entity quality scoring based on field completeness and content richness."""

import logging

logger = logging.getLogger(__name__)


def compute_quality_score(entity_data: dict) -> float:
    """
    Compute a 0.0–1.0 quality score for an entity based on field completeness.

    Weights:
      - university (named, not Unknown): 0.15
      - research_abstract (length-scaled): 0.25
      - scopes (non-empty list): 0.15
      - department (has name): 0.10
      - location (has country): 0.10
      - publications_meta (has items): 0.10
      - point_of_contact (has email or name): 0.05
      - edurank (has data): 0.05
      - images (any): 0.05
    """
    score = 0.0

    # University
    uni = (entity_data.get('university') or '').strip()
    if uni and uni.lower() not in ('', 'unknown institution', 'unknown'):
        score += 0.15

    # Research abstract (scaled by length)
    abstract = (entity_data.get('research_abstract') or '').strip()
    if abstract:
        # 200+ chars = full score, scale linearly below
        score += 0.25 * min(len(abstract) / 200, 1.0)

    # Scopes
    scopes = entity_data.get('scopes') or []
    if isinstance(scopes, list) and len(scopes) > 0:
        score += 0.15

    # Department
    dept = entity_data.get('department') or {}
    if isinstance(dept, dict) and dept.get('name'):
        score += 0.10

    # Location
    loc = entity_data.get('location') or {}
    if isinstance(loc, dict) and loc.get('country'):
        score += 0.10

    # Publications
    pubs = entity_data.get('publications_meta') or {}
    if isinstance(pubs, dict) and pubs.get('key_items'):
        score += 0.10

    # Contact
    contact = entity_data.get('point_of_contact') or {}
    if isinstance(contact, dict) and (contact.get('email') or contact.get('name')):
        score += 0.05

    # Edurank
    edurank = entity_data.get('edurank') or {}
    if isinstance(edurank, dict) and (edurank.get('rank') or edurank.get('score')):
        score += 0.05

    # Images
    images = entity_data.get('images') or []
    if isinstance(images, list) and len(images) > 0:
        score += 0.05

    return round(score, 3)
