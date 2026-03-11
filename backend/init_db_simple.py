import asyncio
import os
import re
from sqlalchemy.ext.asyncio import create_async_engine
from models.db_models import Base
from dotenv import load_dotenv

async def init_db_simple():
    load_dotenv(override=True)
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("DATABASE_URL not found in .env")
        return

    # Match the logic in utils/database.py for asyncpg
    async_url = re.sub(r'^postgresql:', 'postgresql+asyncpg:', database_url)
    
    engine = create_async_engine(async_url)
    
    print(f"Connecting to {async_url}...")
    try:
        async with engine.begin() as conn:
            # Create extension if needed (requires superuser or specific permissions)
            # await conn.execute("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"")
            await conn.run_sync(Base.metadata.create_all)
        print("Tables created successfully!")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(init_db_simple())
