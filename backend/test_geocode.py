import asyncio
import logging
from utils.location import get_location_for_university

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def process_data(structured_data: dict):
    # Check if location is missing or lacks valid coordinates
    if not structured_data.get('location') or not (
        structured_data['location'].get('latitude') and 
        structured_data['location'].get('longitude')
    ):
        # Collect all available contexts for geocoding
        contexts = [
            structured_data.get('department', {}).get('name'),
            structured_data.get('query', ''),
            "lab",
            structured_data.get('research_abstract', '')
        ]
        structured_data['location'] = await get_location_for_university(
            structured_data.get('university'), 
            contexts=[ctx for ctx in contexts if ctx]
        )
    return structured_data

async def test_workflow():
    test_cases = [
        {
            "university": "University of Ghana",
            "department": {"name": "Physics Department"},
            "query": "solar energy labs at University of Ghana",
            "research_abstract": "Research on solar energy technologies",
            "location": {}  # Missing coordinates
        },
        {
            "university": "Stanford University",
            "department": {"name": "Computer Science"},
            "query": "AI lab at Stanford",
            "research_abstract": "",
            "location": {"city": "Stanford", "country": "United States"}  # No coordinates
        },
        {
            "university": "Unknown University",
            "department": {},
            "query": "research lab",
            "research_abstract": "",
            "location": {}  # Expect empty result
        },
        {
            "university": "MIT",
            "department": {"name": "Media Lab"},
            "query": "MIT physics lab",
            "research_abstract": "Advanced physics research",
            "location": {"latitude": 42.3601, "longitude": -71.0942}  # Valid coordinates, should skip
        }
    ]

    for case in test_cases:
        logger.info(f"Testing workflow with case: {case}")
        result = await process_data(case)
        logger.info(f"Result: {result['location']}")
        if result['location'].get('latitude') and result['location'].get('longitude'):
            logger.info(f"Coordinates found: ({result['location']['latitude']}, {result['location']['longitude']})")
        elif result['location'].get('country'):
            logger.info(f"No coordinates but address found: {result['location']}")
        else:
            logger.warning(f"No results for '{case['university']}'")

if __name__ == "__main__":
    asyncio.run(test_workflow())