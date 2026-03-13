import asyncio
import sys
import os
from logging.config import fileConfig
from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine
from sqlalchemy import pool
from alembic import context
from dotenv import load_dotenv

# Add project root to sys.path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(project_root)

# Load .env from project root
load_dotenv(os.path.join(project_root, ".env"))

from models.db_models import Base  # Should resolve to C:\Users\Daniel\Documents\UaiAgent\latest_UI\models\db_models.py

config = context.config

# Override sqlalchemy.url from DATABASE_URL env var
db_url = os.getenv("DATABASE_URL", "")
if db_url:
    # Convert postgresql:// to postgresql+asyncpg:// and sslmode to ssl
    db_url = db_url.strip("'\"")
    print(f"[DEBUG] Raw DATABASE_URL: {db_url}")
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    db_url = db_url.replace("sslmode=", "ssl=")
    # Remove channel_binding parameter (not supported by asyncpg)
    import re
    db_url = re.sub(r'[&?]channel_binding=[^&]*', '', db_url)
    print(f"[DEBUG] Converted DATABASE_URL: {db_url}")
    config.set_main_option("sqlalchemy.url", db_url)
else:
    print("[DEBUG] DATABASE_URL environment variable is not set!")

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

async def run_migrations_online() -> None:
    url = config.get_main_option("sqlalchemy.url")
    print(f"[DEBUG] SQLAlchemy URL being used: {url}")
    connectable = create_async_engine(
        url,
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(
            lambda sync_conn: context.configure(
                connection=sync_conn,
                target_metadata=target_metadata
            )
        )
        async with connection.begin():
            await connection.run_sync(lambda sync_conn: context.run_migrations())

def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())