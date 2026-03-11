import asyncio
import os
import re
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import insert
from models.db_models import Entity
from dotenv import load_dotenv

load_dotenv(override=True)

DATABASE_URL = os.getenv('DATABASE_URL')
engine = create_async_engine(
    re.sub(r'^postgresql:', 'postgresql+asyncpg:', DATABASE_URL),
    echo=False
)

sample_entities = [
    {
        "university": "Stanford University",
        "research_abstract": "Developing next-generation direct air capture technologies using metal-organic frameworks to reduce atmospheric CO2 levels efficiently.",
        "climate_tech_focus": ["Carbon Removal"],
        "url": "https://stanford.edu/carbon-capture",
        "entity_type": "lab"
    },
    {
        "university": "MIT",
        "research_abstract": "Researching organic photovoltaic materials that can be printed onto flexible surfaces, enabling transparent solar windows for urban buildings.",
        "climate_tech_focus": ["Renewable Energy"],
        "url": "https://mit.edu/solar-flow",
        "entity_type": "lab"
    },
    {
        "university": "UC Berkeley",
        "research_abstract": "Utilizing engineered microbial colonies to remove microplastics and heavy metals from wastewater systems with minimal energy input.",
        "climate_tech_focus": ["Water Security"],
        "url": "https://berkeley.edu/aqua-pure",
        "entity_type": "lab"
    },
    {
        "university": "ETH Zurich",
        "research_abstract": "AI-driven demand-response algorithms for decentralized microgrids, optimizing the integration of intermittent renewable sources like wind and solar.",
        "climate_tech_focus": ["Grid Stability"],
        "url": "https://ethz.ch/grid-optimize",
        "entity_type": "lab"
    },
    {
        "university": "National University of Singapore",
        "research_abstract": "Electrochemical sea-water mineral accretion technology to restore coral reefs and enhance coastal protection against sea-level rise.",
        "climate_tech_focus": ["Ocean Health"],
        "url": "https://nus.edu.sg/oceanic-restoration",
        "entity_type": "lab"
    }
]

async def seed_data():
    async with AsyncSession(engine) as session:
        for ent_data in sample_entities:
            await session.execute(insert(Entity).values(**ent_data))
        await session.commit()
    print(f"Successfully seeded {len(sample_entities)} sample entities.")

if __name__ == "__main__":
    asyncio.run(seed_data())
