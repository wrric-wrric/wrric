
import asyncio
import os
import re
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from models.db_models import Event, HackathonConfig
from dotenv import load_dotenv

load_dotenv(override=True)

DATABASE_URL = os.getenv('DATABASE_URL')
engine = create_async_engine(
    re.sub(r'^postgresql:', 'postgresql+asyncpg:', DATABASE_URL),
    echo=False
)

async def list_hackathons():
    async with AsyncSession(engine) as session:
        result = await session.execute(select(Event, HackathonConfig).join(HackathonConfig, Event.id == HackathonConfig.event_id))
        rows = result.all()
        print(f"Total Hackathons: {len(rows)}")
        for event, config in rows:
            print(f"Event ID: {event.id}")
            print(f"Title: {event.title}")
            print(f"Hackathon Config ID: {config.id}")
            print("-" * 20)

if __name__ == "__main__":
    asyncio.run(list_hackathons())
