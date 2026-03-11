import asyncio
import uuid
from sqlalchemy import select
from models.db_models import Event
from utils.database import get_db

async def main():
    async for db in get_db():
        result = await db.execute(select(Event).limit(1))
        event = result.scalar()
        if event:
            print(f"EVENT_ID:{event.id}")
        else:
            print("NO_EVENT")
        break

if __name__ == "__main__":
    asyncio.run(main())
