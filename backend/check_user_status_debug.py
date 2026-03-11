
import asyncio
import os
import uuid
import sys
from sqlalchemy import select

# Add the project directory to sys.path so we can import from models
sys.path.append(os.getcwd())

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from models.db_models import User, HackathonJudge, HackathonConfig, Event

async def check_user_status(user_id_str):
    DATABASE_URL = os.getenv('DATABASE_URL')
    if not DATABASE_URL:
        print("DATABASE_URL not set")
        return
    
    engine = create_async_engine(DATABASE_URL.replace('postgresql:', 'postgresql+asyncpg:'))
    
    async with AsyncSession(engine) as session:
        user_id = uuid.UUID(user_id_str)
        user = await session.get(User, user_id)
        if not user:
            print(f"User {user_id_str} not found.")
            return
            
        print(f"User: {user.username} ({user.email})")
        print(f"Is Admin: {user.is_admin}")
        
        # Check if judge
        judge_query = select(HackathonJudge).where(HackathonJudge.user_id == user_id)
        judge_result = await session.execute(judge_query)
        judge_roles = judge_result.scalars().all()
        
        if judge_roles:
            print(f"Is Judge for {len(judge_roles)} hackathons:")
            for role in judge_roles:
                print(f" - Hackathon ID: {role.hackathon_id} | Display Name: {role.display_name}")
        else:
            print("Is not assigned as a judge.")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        asyncio.run(check_user_status(sys.argv[1]))
    else:
        # Fallback to the one from logs
        asyncio.run(check_user_status("deeb8f49-0e26-46a1-afea-f93789c1c09a"))
