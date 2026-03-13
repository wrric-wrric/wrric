# utils/config.py
import json
import os
import logging
from api.schemas import Config

logger = logging.getLogger(__name__)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_PATH = os.path.join(BASE_DIR, 'data/config.json')

def load_config() -> dict:
    """Load configuration from config.json with defaults from environment variables."""
    default_config = {
        "MAX_URLS": int(os.getenv("MAX_URLS", 10)),
        "MAX_DEPTH": int(os.getenv("MAX_DEPTH", 3)),
        "TIMEOUT_SECONDS": int(os.getenv("TIMEOUT_SECONDS", 300)),
        "REQUEST_TIMEOUT": int(os.getenv("REQUEST_TIMEOUT", 40)),
        "MAX_WORKERS": int(os.getenv("MAX_WORKERS", 3)),
        "GLOBAL_MAX_WORKERS": int(os.getenv("GLOBAL_MAX_WORKERS", 10)),
        "DDGS_MAX_RESULTS": int(os.getenv("DDGS_MAX_RESULTS", 7)),
        "SEARCH_MAX_RESULTS": int(os.getenv("SEARCH_MAX_RESULTS", 5)),
        "MAX_LINKS_PER_PAGE": int(os.getenv("MAX_LINKS_PER_PAGE", 5)),
        "ENABLE_OCR": os.getenv("ENABLE_OCR", "false").lower() == "true",
        "OCR_LANGUAGE": os.getenv("OCR_LANGUAGE", "eng"),
        "LAB_KEYWORDS": [],
        "EDUCATIONAL_DOMAINS": []
    }
    try:
        with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
            config = json.load(f)
        merged_config = {**default_config, **config}
        # Validate with Pydantic
        Config(**merged_config)
        return merged_config
    except FileNotFoundError:
        logger.warning(f"Config file {CONFIG_PATH} not found, using defaults from environment")
        return default_config
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in {CONFIG_PATH}: {str(e)}")
        return default_config
    except Exception as e:
        logger.error(f"Error loading config: {str(e)}")
        return default_config

def save_config(config: dict):
    """Save configuration to config.json."""
    try:
        # Validate before saving
        Config(**config)
        with open(CONFIG_PATH, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=4)
        logger.info("Configuration saved successfully")
    except Exception as e:
        logger.error(f"Failed to save config: {str(e)}")
        raise