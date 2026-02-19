"""Fernet symmetric encryption for Binance API keys at rest."""

import base64
import hashlib

from cryptography.fernet import Fernet

from src.config import settings


def _get_fernet() -> Fernet:
    """Derive a Fernet key from the env-var encryption key."""
    raw = settings.exchange_encryption_key.encode()
    key = base64.urlsafe_b64encode(hashlib.sha256(raw).digest())
    return Fernet(key)


def encrypt(plaintext: str) -> str:
    """Encrypt a plaintext string, returning a base64 ciphertext."""
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    """Decrypt a ciphertext string back to plaintext."""
    return _get_fernet().decrypt(ciphertext.encode()).decode()
