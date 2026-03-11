import asyncio
import uuid
import bcrypt
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from models.db_models import User
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/unlokinno")

async def reset_admin_password():
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        result = await session.execute(select(User).where(User.username == "admin"))
        user = result.scalar_one_or_none()
        
        if user:
            hashed = bcrypt.hashpw("password123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            user.password = hashed
            user.is_admin = True
            await session.commit()
            print("Admin password reset to 'password123' and is_admin set to True.")
        else:
            print("User 'admin' not found.")
            
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(reset_admin_password())
