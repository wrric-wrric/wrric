import asyncio
import os
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from models.db_models import User
import re
from dotenv import load_dotenv

load_dotenv(override=True)

DATABASE_URL = os.getenv('DATABASE_URL')
engine = create_async_engine(
    re.sub(r'^postgresql:', 'postgresql+asyncpg:', DATABASE_URL),
    echo=False
)

async def check_admin():
    async with AsyncSession(engine) as session:
        result = await session.execute(select(User))
        users = result.scalars().all()
        print(f"Total users: {len(users)}")
        for user in users:
            print(f"ID: {user.id}, Username: {user.username}, Email: {user.email}, IsAdmin: {user.is_admin}")

if __name__ == "__main__":
    asyncio.run(check_admin())
