import asyncio
import logging
import os
from dotenv import load_dotenv
from google.generativeai import GenerativeModel

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)
GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY')

# Sub-Saharan African countries for detection
SUB_SAHARAN_COUNTRIES = [
    'angola', 'benin', 'botswana', 'burkina faso', 'burundi', 'cameroon', 'cape verde',
    'central african republic', 'chad', 'comoros', 'congo', 'democratic republic of the congo',
    'djibouti', 'equatorial guinea', 'eritrea', 'eswatini', 'ethiopia', 'gabon', 'gambia',
    'ghana', 'guinea', 'guinea-bissau', 'ivory coast', 'kenya', 'lesotho', 'liberia',
    'madagascar', 'malawi', 'mali', 'mauritania', 'mauritius', 'mozambique', 'namibia',
    'niger', 'nigeria', 'rwanda', 'sao tome and principe', 'senegal', 'seychelles',
    'sierra leone', 'somalia', 'south africa', 'south sudan', 'sudan', 'tanzania', 'togo',
    'uganda', 'zambia', 'zimbabwe'
]

# Keywords that indicate the query is already specific enough
_SPECIFIC_KEYWORDS = {
    'university', 'institute', 'college', 'lab', 'laboratory', 'center', 'centre',
    'department', 'faculty', 'school of',
}

# Keywords that indicate a research/academic context
_RESEARCH_KEYWORDS = {
    'research', 'innovation', 'technology', 'science', 'r&d', 'biotech',
    'ai', 'materials', 'energy', 'robotics', 'academic',
}


def _query_has_institution(query_lower: str) -> bool:
    """Check if query already references a specific institution."""
    return any(kw in query_lower for kw in _SPECIFIC_KEYWORDS)


def _query_has_region(query_lower: str) -> bool:
    """Check if query already specifies a geographic region or country."""
    # Check for Sub-Saharan countries
    if any(country in query_lower for country in SUB_SAHARAN_COUNTRIES):
        return True
    # Check for other common regions/countries
    region_indicators = [
        'africa', 'europe', 'asia', 'america', 'usa', 'uk', 'china', 'india',
        'japan', 'korea', 'australia', 'canada', 'germany', 'france', 'brazil',
        'mit', 'stanford', 'harvard', 'oxford', 'cambridge',
    ]
    return any(r in query_lower for r in region_indicators)


async def refine_query(query: str) -> str:
    """Refine a query to target academic R&D labs.

    Context-aware (Phase 3.4):
    - If the query already specifies a region or institution, don't override it.
    - If the query is a Sub-Saharan country name, target that country's labs.
    - Only add "Sub-Saharan Africa" focus when the query is generic.
    """
    if not query or not query.strip():
        logger.error("Empty or invalid query provided for refinement")
        return "science and technology R&D labs in Sub-Saharan African universities"

    query_lower = query.lower().strip()

    # If query already mentions a specific institution + research context, return as-is
    if _query_has_institution(query_lower) and len(query_lower.split()) > 2:
        logger.debug(f"Query already specific (has institution): {query}")
        return query

    # If query mentions a non-African region/institution, don't force Africa focus
    if _query_has_region(query_lower) and any(kw in query_lower for kw in _RESEARCH_KEYWORDS):
        logger.debug(f"Query already has region + research context: {query}")
        return query

    # If query is just a country name
    if query_lower in SUB_SAHARAN_COUNTRIES:
        return f"{query} university science and technology R&D labs"

    # For short generic queries, try LLM refinement
    if not GOOGLE_API_KEY:
        logger.warning("GOOGLE_API_KEY not set, using rule-based fallback")
        if _query_has_region(query_lower):
            return f"{query} university R&D labs research"
        return f"{query} science and technology R&D labs in Sub-Saharan African universities"

    try:
        model = GenerativeModel('gemini-2.0-flash', generation_config={"temperature": 0.1})
        prompt = f"""Refine this search query to find academic R&D labs, innovation hubs, or research centers.

Rules:
- If the query mentions a specific region, country, or institution, keep that context — do NOT change the geographic focus.
- If the query is generic (no region/institution), target Sub-Saharan African universities.
- Keep it concise (under 15 words).
- Return ONLY the refined query as plain text. No explanation.

Examples:
- "climate research" → "climate research R&D labs in Sub-Saharan African universities"
- "MIT robotics lab" → "MIT robotics lab"  (already specific)
- "AI innovation at University of Rwanda" → "AI innovation at University of Rwanda"
- "Rwanda" → "Rwandan university science and technology R&D labs"
- "biotech Europe" → "biotechnology R&D labs at European universities"
- "sustainable energy" → "renewable energy R&D labs in Sub-Saharan African universities"
- "Stanford materials science" → "Stanford materials science research lab"

Query: {query}"""

        response = await asyncio.wait_for(
            asyncio.get_event_loop().run_in_executor(
                None,
                lambda: model.generate_content(prompt)
            ),
            timeout=10.0
        )
        refined_query = response.text.strip()
        logger.debug(f"Gemini refined query: {query} -> {refined_query}")

        if not refined_query:
            logger.warning("Empty refined query from Gemini, using fallback")
            return f"{query} science and technology R&D labs"

        # Sanity check: ensure original query terms are preserved
        query_words = set(query_lower.split())
        refined_words = set(refined_query.lower().split())
        if not any(word in refined_words for word in query_words):
            logger.warning(f"Refined query '{refined_query}' lost original intent, using fallback")
            return f"{query} university R&D labs research"

        return refined_query
    except Exception as e:
        logger.error(f"Failed to refine query with Gemini: {e}")
        if _query_has_region(query_lower):
            return f"{query} university R&D labs research"
        return f"{query} science and technology R&D labs in Sub-Saharan African universities"
