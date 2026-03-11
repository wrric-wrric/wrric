import aiohttp
import logging
import os
from fastapi import HTTPException
from typing import Optional

logger = logging.getLogger(__name__)

async def verify_recaptcha(response: str) -> bool:
    """Verify Google reCAPTCHA v2 Checkbox response.

    Args:
        response: The g-recaptcha-response string from the client.

    Returns:
        bool: True if verification succeeds, False otherwise.

    Raises:
        HTTPException: If the RECAPTCHA_SECRET_KEY is not set.
    """
    secret_key: Optional[str] = os.getenv("RECAPTCHA_SECRET_KEY")
    if not secret_key:
        logger.error("RECAPTCHA_SECRET_KEY not set")
        raise HTTPException(status_code=500, detail="Server configuration error")
    
    async with aiohttp.ClientSession() as session:
        async with session.post(
            "https://www.google.com/recaptcha/api/siteverify",
            data={"secret": secret_key, "response": response}
        ) as resp:
            if resp.status != 200:
                logger.error(f"reCAPTCHA verification failed with status {resp.status}")
                return False
            result = await resp.json()
            success = result.get("success", False)
            if not success:
                logger.warning(f"reCAPTCHA verification failed: {result.get('error-codes', [])}")
            else:
                logger.info("reCAPTCHA verification succeeded")
            return success