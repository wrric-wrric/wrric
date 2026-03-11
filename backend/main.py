import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse, HTMLResponse
from fastapi.templating import Jinja2Templates
import uvicorn
from dotenv import load_dotenv

# --- Local imports ---
from ws_module.handlers.websocket_manager import websocket_endpoint
from ws_module.messages.router import websocket_router as message_websocket_router  
from api.routes import router as api_router
from api.auth import router as auth_router
from utils.database import init_db, engine
from utils.helpers import init_model_and_embeddings
from media.storage import CustomB2Storage
from algorithms.matchmaking_enhanced import start_matchmaker, shutdown_matchmaker, trigger_matchmaking_now
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from utils.logger import get_logger
from utils.invitation_cleanup import cleanup_expired_invitations

logger = get_logger()

scheduler = AsyncIOScheduler()


load_dotenv()

# === Global settings ===
RECAPTCHA_KEY = os.getenv("RECAPTCHA_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

# === Initialize Backblaze Storage ===
storage = CustomB2Storage()


# === Lifespan Management ===
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Starting up Unlokinno Intelligence API...")

    # Initialize Database
    try:
        logger.info("Initializing database connection...")
        await init_db()
        logger.info("✅ Database connected successfully.")
    except Exception as e:
        logger.exception("❌ Failed to initialize database.")
        raise

# Start matchmaking scheduler
    try:
        await start_matchmaker()
        logger.info("✅ Matchmaking algorithm started.")
    except Exception as e:
        logger.exception("❌ Failed to start matchmaking algorithm.")
        raise

    # Start invitation cleanup scheduler
    try:
        scheduler.add_job(
            cleanup_expired_invitations,
            'interval',
            hours=1,
            id='invitation_cleanup',
            name='Clean up expired invitations',
            replace_existing=True
        )
        scheduler.start()
        logger.info("✅ Invitation cleanup scheduler started.")
    except Exception as e:
        logger.exception("❌ Failed to start invitation cleanup scheduler.")
        raise

    yield  # Application runs here

    # Shutdown clean-up
    logger.info("🛑 Shutting down application...")
    await shutdown_matchmaker(scheduler)
    try:
        await engine.dispose()
        logger.info("✅ Database connections closed cleanly.")
    except Exception as e:
        logger.exception("❌ Error closing database connections.")
        

# === FastAPI App ===
app = FastAPI(
    title="Unlokinno Intelligence API",
    description="FastAPI-based research intelligence system for climate tech labs and startups, with WebSocket streaming and B2 integration.",
    version="1.0.0",
    lifespan=lifespan,
)

# === Middleware ===
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === Routers ===
app.include_router(api_router, prefix="/api")
app.include_router(auth_router, prefix="/api/auth")

# === WebSocket Routes ===
app.websocket("/ws")(websocket_endpoint)

# New WebSocket for messaging system
app.include_router(message_websocket_router, prefix="/ws")  # This will create /ws/messages

# === Static Files + Templates ===
if not os.path.exists(FRONTEND_DIR):
    logger.error(f"❌ Frontend directory NOT FOUND at: {FRONTEND_DIR}")
    os.makedirs(FRONTEND_DIR, exist_ok=True) # Ensure it exists

app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")
templates = Jinja2Templates(directory=FRONTEND_DIR)

# === Routes ===

@app.get("/", response_class=FileResponse)
@app.get("/dashboard", response_class=FileResponse)
async def serve_dashboard():
    """Serve the dashboard page at root and /dashboard."""
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if not os.path.exists(index_path):
        logger.warning(f"⚠️ index.html not found at {index_path}, redirecting to /docs")
        return RedirectResponse(url="/docs")
    return FileResponse(index_path)

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    """Serve favicon for browsers."""
    favicon_path = os.path.join(FRONTEND_DIR, "imgs", "icon.png")
    if not os.path.exists(favicon_path):
        return RedirectResponse(url="https://fastapi.tiangolo.com/img/favicon.png")
    return FileResponse(favicon_path)


@app.get("/login", response_class=FileResponse)
async def serve_login(request: Request):
    """Serve login page."""
    login_path = os.path.join(FRONTEND_DIR, "login.html")
    if not os.path.exists(login_path):
        logger.error("❌ login.html not found at %s", login_path)
        raise HTTPException(status_code=404, detail="Login page not found")

    logger.debug("Serving login.html with reCAPTCHA key.")
    return templates.TemplateResponse(
        "login.html", {"request": request, "recaptcha_site_key": RECAPTCHA_KEY}
    )


@app.get("/signup", response_class=FileResponse)
async def serve_signup(request: Request):
    """Serve signup page."""
    signup_path = os.path.join(FRONTEND_DIR, "signup.html")
    if not os.path.exists(signup_path):
        logger.error("❌ signup.html not found at %s", signup_path)
        raise HTTPException(status_code=404, detail="Signup page not found")

    logger.debug("Serving signup.html with reCAPTCHA key.")
    return templates.TemplateResponse(
        "signup.html", {"request": request, "recaptcha_site_key": RECAPTCHA_KEY}
    )


@app.get("/events/{event_id}/register", response_class=FileResponse)
async def serve_event_register(request: Request, event_id: str):
    """Serve event registration page."""
    register_path = os.path.join(FRONTEND_DIR, "event_register.html")
    if not os.path.exists(register_path):
        logger.error("❌ event_register.html not found at %s", register_path)
        raise HTTPException(status_code=404, detail="Event registration page not found")

    logger.debug(f"Serving event_register.html for event {event_id}")
    return FileResponse(register_path)


@app.get("/file/{filename}")
async def get_file_url(filename: str):
    """Return a pre-signed Backblaze B2 URL for the given file."""
    try:
        url = storage.url(filename)
        if not url:
            raise HTTPException(status_code=404, detail="File not found or inaccessible")
        return {"url": url}
    except Exception as e:
        logger.exception("Error generating file URL")
        raise HTTPException(status_code=500, detail=str(e))


# === Local Dev Entry Point ===
if __name__ == "__main__":
    if os.getenv("RUN_WITH_GUNICORN") != "1":
        uvicorn.run(
            "main:app",
            host="0.0.0.0",
            port=8000,
            reload=True,
            ws="wsproto",
            log_level="debug",
        )