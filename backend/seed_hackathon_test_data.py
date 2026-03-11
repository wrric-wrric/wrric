
import asyncio
import os
import re
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from models.db_models import HackathonConfig, HackathonParticipant, HackathonCategory, CategoryParticipantMembership
from dotenv import load_dotenv

load_dotenv(override=True)

DATABASE_URL = os.getenv('DATABASE_URL')
# Use the working venv path if possible, but the connection string is what matters for the script logic
engine = create_async_engine(
    re.sub(r'^postgresql:', 'postgresql+asyncpg:', DATABASE_URL),
    echo=False
)

HACKATHON_CONFIG_ID = uuid.UUID("39b687da-efe5-4eec-9160-90ed4a29cef7")

categories_data = [
    {"name": "AI & Machine Learning", "description": "Projects focusing on artificial intelligence and ML models."},
    {"name": "Sustainability", "description": "Eco-friendly and sustainable solutions."},
    {"name": "Fintech", "description": "Financial technology and blockchain innovations."},
    {"name": "HealthTech", "description": "Technology-driven healthcare solutions."},
    {"name": "EduTech", "description": "Educational technology and learning platforms."}
]

participants_data = [
    {"first_name": "Alice", "last_name": "Smith", "email": "alice@example.com", "project_title": "AI Diagnoser", "team_name": "Team Alpha"},
    {"first_name": "Bob", "last_name": "Johnson", "email": "bob@example.com", "project_title": "EcoTrack", "team_name": "Green Code"},
    {"first_name": "Charlie", "last_name": "Brown", "email": "charlie@example.com", "project_title": "PayChain", "team_name": "BlockMasters"},
    {"first_name": "Diana", "last_name": "Prince", "email": "diana@example.com", "project_title": "HeartWatch", "team_name": "Health Hero"},
    {"first_name": "Ethan", "last_name": "Hunt", "email": "ethan@example.com", "project_title": "LearnLoop", "team_name": "Mission Possible"}
]

async def seed_test_data():
    async with AsyncSession(engine) as session:
        # 1. Create Categories
        categories = []
        for cat in categories_data:
            new_cat = HackathonCategory(
                hackathon_id=HACKATHON_CONFIG_ID,
                name=cat["name"],
                description=cat["description"],
                category_type="Track"
            )
            session.add(new_cat)
            categories.append(new_cat)
        
        await session.flush() # Get IDs
        print(f"Created {len(categories)} categories.")

        # 2. Create Participants
        participants = []
        for p in participants_data:
            new_p = HackathonParticipant(
                hackathon_id=HACKATHON_CONFIG_ID,
                first_name=p["first_name"],
                last_name=p["last_name"],
                email=p["email"],
                project_title=p["project_title"],
                team_name=p["team_name"],
                participant_type="Individual"
            )
            session.add(new_p)
            participants.append(new_p)
        
        await session.flush() # Get IDs
        print(f"Created {len(participants)} participants.")

        # 3. Link Participants to Categories (1-to-1 for simplicity)
        for i in range(len(participants)):
            membership = CategoryParticipantMembership(
                category_id=categories[i].id,
                participant_id=participants[i].id
            )
            session.add(membership)
        
        await session.commit()
        print("Successfully linked participants to categories.")

if __name__ == "__main__":
    asyncio.run(seed_test_data())
