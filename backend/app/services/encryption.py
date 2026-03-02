import base64
import hashlib
from cryptography.fernet import Fernet


def _derive_key(secret: str) -> bytes:
    """Derive a 32-byte Fernet key from the JWT secret."""
    digest = hashlib.sha256(secret.encode()).digest()
    return base64.urlsafe_b64encode(digest)


def encrypt_api_key(plain_key: str, secret: str) -> str:
    f = Fernet(_derive_key(secret))
    return f.encrypt(plain_key.encode()).decode()


def decrypt_api_key(encrypted_key: str, secret: str) -> str:
    f = Fernet(_derive_key(secret))
    return f.decrypt(encrypted_key.encode()).decode()


def mask_key(plain_key: str) -> str:
    """Show only the last 4 characters, mask the rest."""
    if len(plain_key) <= 4:
        return "****"
    return "*" * (len(plain_key) - 4) + plain_key[-4:]
