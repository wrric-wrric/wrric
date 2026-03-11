# utils/logger.py
import os
import logging
from logging.handlers import RotatingFileHandler

# Create a shared logger name
LOGGER_NAME = "unlokinno"

# Respect LOG_LEVEL env var (defaults to INFO in production)
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

# Ensure logs directory exists
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG_DIR = os.path.join(BASE_DIR, "logs")
os.makedirs(LOG_DIR, exist_ok=True)
LOG_FILE = os.path.join(LOG_DIR, "app.log")

# Max 5MB per log file, keep 3 rotated backups (15MB total max)
MAX_LOG_BYTES = 5 * 1024 * 1024
BACKUP_COUNT = 3


def get_logger(name: str = None) -> logging.Logger:
    """
    Returns a consistent logger that shares configuration with the main app.
    Automatically sets up handlers if they don't already exist.
    """
    logger_name = f"{LOGGER_NAME}.{name}" if name else LOGGER_NAME
    logger = logging.getLogger(logger_name)

    # If the base logger isn't configured yet, configure it.
    if not logging.getLogger(LOGGER_NAME).handlers:
        base_logger = logging.getLogger(LOGGER_NAME)
        base_logger.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))

        file_handler = RotatingFileHandler(
            LOG_FILE, mode="a", encoding="utf-8",
            maxBytes=MAX_LOG_BYTES, backupCount=BACKUP_COUNT
        )
        file_handler.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))
        file_formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        )
        file_handler.setFormatter(file_formatter)
        base_logger.addHandler(file_handler)

        console_handler = logging.StreamHandler()
        console_handler.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))
        console_formatter = logging.Formatter(
            "%(asctime)s - %(levelname)s - %(message)s"
        )
        console_handler.setFormatter(console_formatter)
        base_logger.addHandler(console_handler)

        base_logger.info("Logging initialized (level=%s)", LOG_LEVEL)

    return logger
