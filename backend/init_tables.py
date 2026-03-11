import asyncio
from utils.database import init_db
from dotenv import load_dotenv

async def main():
    load_dotenv()
    print("Starting database initialization...")
    try:
        await init_db()
        print("Database initialized successfully!")
    except Exception as e:
        print(f"Error initializing database: {e}")

if __name__ == "__main__":
    asyncio.run(main())
