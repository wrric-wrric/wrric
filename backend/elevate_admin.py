import asyncio
import uuid
import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, update
from models.db_models import User, Profile

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

async def elevate_admin():
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # 1. Find the target user (stannoh)
        result = await db.execute(select(User).where(User.username == "stannoh"))
        target_user = result.scalars().first()
        
        if not target_user:
            print("User 'stannoh' not found.")
            return

        # 2. Ensure is_admin is True
        if not target_user.is_admin:
            await db.execute(update(User).where(User.id == target_user.id).values(is_admin=True))
            print(f"Set is_admin=True for user: {target_user.username}")
        
        # 3. Ensure profiles exist for all major types
        required_types = ["lab", "funder", "entrepreneur", "academic"]
        
        result = await db.execute(select(Profile).where(Profile.user_id == target_user.id))
        existing_profiles = result.scalars().all()
        existing_types = {p.type for p in existing_profiles}
        
        print(f"Existing profile types for stannoh: {existing_types}")
        
        for p_type in required_types:
            if p_type not in existing_types:
                print(f"Creating missing profile type: {p_type}")
                new_profile = Profile(
                    id=uuid.uuid4(),
                    user_id=target_user.id,
                    type=p_type,
                    display_name=f"Stannoh ({p_type.capitalize()})",
                    is_default=(p_type == "lab" and not existing_profiles),
                    organization="Unlokinno Global Admin",
                    bio=f"Super Admin profile for {p_type} module visibility."
                )
                db.add(new_profile)
        
        await db.commit()
        print("Admin elevation complete. Please log in again to see all modules.")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(elevate_admin())
