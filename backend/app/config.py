import json
from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache


class Settings(BaseSettings):
    debug: bool = False

    # Database
    database_url: str = "postgresql+asyncpg://postgres:changeme@localhost:5433/fpna_insights"

    # Auth
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60

    # External services — LLM (OpenRouter preferred, Perplexity fallback)
    openrouter_api_key: str = ""
    openrouter_model: str = "google/gemini-2.0-flash-001"
    perplexity_api_key: str = ""
    mcp_server_url: str = "http://mcp:8000"

    # CORS — accepts JSON array or comma-separated string
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        val = self.cors_origins.strip()
        if val.startswith("["):
            return json.loads(val)
        return [s.strip() for s in val.split(",") if s.strip()]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
