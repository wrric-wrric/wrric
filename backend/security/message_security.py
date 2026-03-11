import os
import re
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64
from fastapi import HTTPException

class MessageEncryption:
    def __init__(self):
        self.key = os.getenv("MESSAGE_ENCRYPTION_KEY")
        if not self.key:
            raise ValueError("MESSAGE_ENCRYPTION_KEY environment variable required")
        
        # Derive key from environment variable
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=b'message_salt',
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(self.key.encode()))
        self.fernet = Fernet(key)

    def encrypt_message(self, content: str) -> str:
        return self.fernet.encrypt(content.encode()).decode()

    def decrypt_message(self, encrypted_content: str) -> str:
        return self.fernet.decrypt(encrypted_content.encode()).decode()

class MessageValidator:
    @staticmethod
    def validate_message_content(content: str, message_type: str):
        if message_type == "text" and content:
            # Sanitize and validate text content
            if len(content) > 10000:  # 10KB limit for text
                raise HTTPException(status_code=400, detail="Message too long")
            
            # Basic XSS prevention
            suspicious_patterns = [r"<script.*?>", r"javascript:", r"onload="]
            for pattern in suspicious_patterns:
                if re.search(pattern, content, re.IGNORECASE):
                    raise HTTPException(status_code=400, detail="Invalid content detected")
        
    @staticmethod
    def validate_file_upload(file_size: int, mime_type: str):
        MAX_SIZES = {
            'image': 10 * 1024 * 1024,  # 10MB
            'document': 25 * 1024 * 1024,  # 25MB
            'video': 100 * 1024 * 1024,  # 100MB
        }
        
        file_type = mime_type.split('/')[0]
        max_size = MAX_SIZES.get(file_type, 5 * 1024 * 1024)  # Default 5MB
        
        if file_size > max_size:
            raise HTTPException(status_code=400, detail=f"File too large. Max size: {max_size//1024//1024}MB")