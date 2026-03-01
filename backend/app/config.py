from pydantic_settings import BaseSettings
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

    # CORS
    cors_origins: list[str] = ["http://localhost:3000"]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
