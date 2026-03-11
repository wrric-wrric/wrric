
import asyncio
import os
import uuid
import sys
from sqlalchemy import select

# Add the project directory to sys.path so we can import from models
sys.path.append(os.getcwd())

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from models.db_models import User, HackathonJudge, HackathonConfig, Event

async def list_judges():
    DATABASE_URL = os.getenv('DATABASE_URL')
    if not DATABASE_URL:
        print("DATABASE_URL not set")
        return
    
    engine = create_async_engine(DATABASE_URL.replace('postgresql:', 'postgresql+asyncpg:'))
    
    async with AsyncSession(engine) as session:
        # Find all judges
        query = select(User, HackathonJudge, Event).join(
            HackathonJudge, User.id == HackathonJudge.user_id
        ).join(
            HackathonConfig, HackathonJudge.hackathon_id == HackathonConfig.id
        ).join(
            Event, HackathonConfig.event_id == Event.id
        )
        
        result = await session.execute(query)
        judges = result.all()
        
        if not judges:
            print("No judges found in the database.")
            return
            
        print(f"Found {len(judges)} judge assignments:")
        for user, judge, event in judges:
            print(f"User: {user.username} ({user.email}) | Admin: {user.is_admin} | Event: {event.title}")

if __name__ == "__main__":
    asyncio.run(list_judges())
