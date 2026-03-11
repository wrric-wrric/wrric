import asyncio
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, Text
import json

# Minimal models for testing
class Base(DeclarativeBase):
    pass

class EventRegistration(Base):
    __tablename__ = "event_registrations"
    id = Column(UUID(as_uuid=True), primary_key=True)
    event_id = Column(UUID(as_uuid=True))
    first_name = Column(String)
    last_name = Column(String)
    email = Column(String)
    organization = Column(String)
    metadata_ = Column(JSONB)
    registration_date = Column(DateTime)

DATABASE_URL = "postgresql+asyncpg://postgres:9858@localhost:5432/unlokinno"
EVENT_ID = "5f7c3568-77d9-4a0a-91a2-b3263acf3464"

async def main():
    engine = create_async_engine(DATABASE_URL)
    async_session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    
    async with async_session() as session:
        print(f"Checking registrations for event: {EVENT_ID}")
        query = select(EventRegistration).where(EventRegistration.event_id == uuid.UUID(EVENT_ID))
        result = await session.execute(query)
        regs = result.scalars().all()
        
        print(f"Found {len(regs)} registrations.")
        for reg in regs:
            try:
                # Try to serialize to JSON to see where it fails
                data = {
                    "id": str(reg.id),
                    "first_name": reg.first_name,
                    "last_name": reg.last_name,
                    "email": reg.email,
                    "organization": reg.organization,
                    "metadata_": reg.metadata_,
                    "registration_date": str(reg.registration_date)
                }
                json.dumps(data)
                print(f"OK: {reg.first_name} {reg.last_name} ({reg.email})")
            except Exception as e:
                print(f"FAIL: {reg.first_name} {reg.last_name} ({reg.email}) - Error: {e}")
                print(f"Metadata Type: {type(reg.metadata_)}")
                print(f"Metadata Value: {reg.metadata_}")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
