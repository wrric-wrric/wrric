import asyncio
from typing import Dict
from fastapi import WebSocket
import uuid
import logging
import json

logger = logging.getLogger(__name__)

class UUIDEncoder(json.JSONEncoder):
    """Custom JSON encoder to handle UUID objects."""
    def default(self, obj):
        if isinstance(obj, uuid.UUID):
            return str(obj)
        return super().default(obj)

class ScraperState:
    """Tracks the state of a user's chatbot session."""
    def __init__(self):
        self.is_running = False
        self.task: asyncio.Task = None
        self.urls_queue: asyncio.Queue = asyncio.Queue()
        self.current_urls = set()
        self.processed_urls = set()
        self.cancelled = False
        self.session_id = None
        self.user_id = None
        self.title = None

class WebSocketManager:
    """Manages WebSocket connections and per-user chatbot states."""
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.scraper_states: Dict[str, ScraperState] = {}

    async def connect(self, websocket: WebSocket) -> str:
        """Accept a new WebSocket connection and assign a session ID."""
        await websocket.accept()
        session_id = str(uuid.uuid4())
        self.active_connections[session_id] = websocket
        self.scraper_states[session_id] = ScraperState()
        logger.info(f"New WebSocket connection: {session_id}")
        return session_id

    async def disconnect(self, session_id: str):
        """Remove a WebSocket connection and clean up its state."""
        if session_id in self.active_connections:
            del self.active_connections[session_id]
        if session_id in self.scraper_states:
            state = self.scraper_states[session_id]
            state.cancelled = True
            if state.task:
                state.task.cancel()
            del self.scraper_states[session_id]
        logger.info(f"WebSocket disconnected: {session_id}")

    async def send_message(self, session_id: str, message: dict):
        """Send a JSON message to a specific WebSocket client."""
        if session_id in self.active_connections:
            try:
                # Pre-serialize the message to handle UUID objects
                serialized_message = json.dumps(message, cls=UUIDEncoder)
                await self.active_connections[session_id].send_json(json.loads(serialized_message))
            except Exception as e:
                logger.error(f"Failed to send message to {session_id}: {str(e)}")
                await self.disconnect(session_id)

    def get_state(self, session_id: str) -> ScraperState:
        """Retrieve the chatbot state for a session."""
        return self.scraper_states.get(session_id)

manager = WebSocketManager()