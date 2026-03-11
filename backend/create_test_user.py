import asyncio
import os
import re
import uuid
import bcrypt
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from models.db_models import User, Profile
from dotenv import load_dotenv

async def create_test_user():
    load_dotenv(override=True)
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("DATABASE_URL not found in .env")
        return

    async_url = re.sub(r'^postgresql:', 'postgresql+asyncpg:', database_url)
    engine = create_async_engine(async_url)
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    username = "admin"
    email = "admin@example.com"
    password = "password123"
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    async with async_session() as session:
        try:
            # Create user
            user = User(
                id=uuid.uuid4(),
                username=username,
                email=email,
                password=hashed_password,
                is_admin=True
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)

            # Create default profile
            profile = Profile(
                id=uuid.uuid4(),
                user_id=user.id,
                is_default=True,
                display_name=username,
                type="innovator" # default type
            )
            session.add(profile)
            await session.commit()
            print(f"Test user created successfully!\nUsername: {username}\nEmail: {email}\nPassword: {password}")
        except Exception as e:
            print(f"Error creating user: {e}")
            await session.rollback()
        finally:
            await session.close()
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(create_test_user())
