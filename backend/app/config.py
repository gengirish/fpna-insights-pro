import json
import warnings
from pydantic_settings import BaseSettings
from functools import lru_cache

_INSECURE_DEFAULTS = {"change-me-in-production", "changeme", ""}


class Settings(BaseSettings):
    debug: bool = False

    # Database
    database_url: str = "postgresql+asyncpg://postgres:changeme@localhost:5433/fpna_insights"

    # Auth
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60
    cookie_secure: bool = False  # True in production (HTTPS)
    cookie_samesite: str = "lax"  # "none" for cross-origin deployments (Vercel + Fly.io)
    cookie_domain: str | None = None

    # External services — LLM (OpenRouter preferred, Perplexity fallback)
    openrouter_api_key: str = ""
    openrouter_model: str = "google/gemini-2.0-flash-001"
    perplexity_api_key: str = ""
    mcp_server_url: str = "http://mcp-server:3000"

    # CORS — accepts JSON array or comma-separated string
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        val = self.cors_origins.strip()
        if val.startswith("["):
            try:
                return json.loads(val)
            except json.JSONDecodeError:
                warnings.warn(f"Malformed CORS_ORIGINS JSON: {val!r}, falling back to split")
                return [s.strip() for s in val.strip("[]").split(",") if s.strip()]
        return [s.strip() for s in val.split(",") if s.strip()]

    def validate_production_secrets(self) -> None:
        if not self.debug and self.jwt_secret in _INSECURE_DEFAULTS:
            raise RuntimeError(
                "JWT_SECRET must be set to a strong value in production. "
                "Generate one with: openssl rand -hex 32"
            )

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.validate_production_secrets()
    return settings
