"""Sanitize internal errors before sending to clients via WebSocket."""

import logging

logger = logging.getLogger(__name__)

# Error patterns that indicate internal/sensitive errors
_INTERNAL_PATTERNS = [
    "sqlalchemy", "psycopg", "asyncpg", "connectionpool",
    "operationalerror", "interfaceerror", "programmingerror",
    "integrityerror", "databaseerror", "invalidrequest",
    "traceback", "file ", "/home/", "/app/", "c:\\",
    "password", "secret", "token", "credential",
    "neon.tech", "postgresql://", "postgres://",
    "api_key", "apikey", "bearer",
    "modulenotfounderror", "importerror", "attributeerror",
    "nameerror", "typeerror", "keyerror", "indexerror",
    "valueerror",
]

# User-friendly messages for known error categories
_FRIENDLY_MESSAGES = {
    "sqlalchemy": "A database error occurred. Please try again.",
    "psycopg": "A database connection error occurred. Please try again.",
    "asyncpg": "A database connection error occurred. Please try again.",
    "connectionpool": "A database connection error occurred. Please try again.",
    "timeout": "The request timed out. Please try again.",
    "rate": "External service rate limit reached. Please wait a moment and try again.",
    "429": "External service rate limit reached. Please wait a moment and try again.",
    "nameerror": "An internal processing error occurred. Please try again.",
    "keyerror": "An internal processing error occurred. Please try again.",
    "typeerror": "An internal processing error occurred. Please try again.",
}


def sanitize_error(error: Exception | str, context: str = "") -> str:
    """
    Convert an internal error into a safe, user-friendly message.

    The original error is always logged at ERROR level for debugging.
    Only a sanitized version is returned for sending to the client.
    """
    # Handle timeout errors explicitly (str() is often empty)
    if isinstance(error, (TimeoutError, OSError)) and "timed out" in type(error).__name__.lower() + str(error).lower():
        logger.error(f"Timeout error [{context}]", exc_info=True)
        return "The request timed out. Please try again."
    if isinstance(error, TimeoutError):
        logger.error(f"Timeout error [{context}]", exc_info=True)
        return "The request timed out. Please try again."

    error_str = str(error).lower()

    # Log the full error for debugging
    logger.error(f"Internal error [{context}]: {error}", exc_info=isinstance(error, Exception))

    # Check for known patterns and return friendly message
    for pattern, message in _FRIENDLY_MESSAGES.items():
        if pattern in error_str:
            return message

    # Check if error contains any sensitive patterns
    for pattern in _INTERNAL_PATTERNS:
        if pattern in error_str:
            return "An internal error occurred. Please try again."

    # For short, non-sensitive errors, pass through (e.g. "No search results available")
    original = str(error)
    if len(original) < 200 and not any(p in error_str for p in _INTERNAL_PATTERNS):
        return original

    return "An unexpected error occurred. Please try again."
