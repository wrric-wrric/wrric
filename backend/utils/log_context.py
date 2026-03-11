"""Structured logging context for pipeline operations."""

import logging
import contextvars

# Context var for current session/query ID
_session_id: contextvars.ContextVar[str] = contextvars.ContextVar('session_id', default='')


def set_session_id(sid: str):
    _session_id.set(sid)


def get_session_id() -> str:
    return _session_id.get()


class SessionFilter(logging.Filter):
    """Inject session_id into all log records."""

    def filter(self, record):
        record.session_id = _session_id.get()
        return True


def setup_pipeline_logging():
    """Add SessionFilter to root logger (call once at startup)."""
    root = logging.getLogger()
    if not any(isinstance(f, SessionFilter) for f in root.filters):
        root.addFilter(SessionFilter())
