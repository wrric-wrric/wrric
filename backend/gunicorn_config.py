import logging
import os
from logging.handlers import RotatingFileHandler

# Gunicorn settings
bind = "0.0.0.0:8000"
workers = 1
worker_class = "my_uvicorn_worker.MyUvicornWorker"
timeout = 120
loglevel = os.getenv("LOG_LEVEL", "warning").lower()
accesslog = "-"  # Redirect to logging module
errorlog = "-"   # Redirect to logging module
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"'
preload = True
ws = "wsproto"

# Logging setup
log_dir = "/app/logs"
os.makedirs(log_dir, exist_ok=True)

# Max 5MB per log file, keep 3 rotated backups
MAX_LOG_BYTES = 5 * 1024 * 1024
BACKUP_COUNT = 3

LOG_LEVEL = os.getenv("LOG_LEVEL", "WARNING").upper()
log_level_int = getattr(logging, LOG_LEVEL, logging.WARNING)

error_log = os.path.join(log_dir, "error.log")
access_log = os.path.join(log_dir, "access.log")
for log_file in [error_log, access_log]:
    if not os.path.exists(log_file):
        open(log_file, "a").close()
        os.chmod(log_file, 0o664)

# Configure logger
logger = logging.getLogger("gunicorn")
logger.setLevel(log_level_int)

# Remove existing handlers
for handler in logger.handlers[:]:
    logger.removeHandler(handler)

# Console handler
console_handler = logging.StreamHandler()
console_handler.setLevel(log_level_int)
console_formatter = logging.Formatter(
    "%(asctime)s - %(levelname)s - %(name)s - %(message)s"
)
console_handler.setFormatter(console_formatter)
logger.addHandler(console_handler)

# File handler for error.log (rotating)
file_handler = RotatingFileHandler(
    error_log, maxBytes=MAX_LOG_BYTES, backupCount=BACKUP_COUNT
)
file_handler.setLevel(logging.ERROR)
file_handler.setFormatter(console_formatter)
logger.addHandler(file_handler)

# File handler for access.log (rotating)
access_handler = RotatingFileHandler(
    access_log, maxBytes=MAX_LOG_BYTES, backupCount=BACKUP_COUNT
)
access_handler.setLevel(log_level_int)
access_handler.setFormatter(console_formatter)
logger.addHandler(access_handler)
