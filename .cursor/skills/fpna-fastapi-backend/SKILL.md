---
name: fpna-fastapi-backend
description: Build and maintain the FPnA Insights PRO FastAPI backend with production best practices. Use when creating API endpoints, services, middleware, or backend configuration for the FPnA financial dashboard.
---

# FPnA FastAPI Backend

## Project Context

FPnA Insights PRO is a financial planning & analysis dashboard. The backend serves:
- Dashboard data endpoints (KPIs, time series)
- RAG query endpoint (Postgres MCP + Perplexity Sonar)
- Health check endpoints
- Authentication endpoints

## Architecture

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # Application factory
│   ├── config.py            # Pydantic Settings
│   ├── dependencies.py      # DI: DB sessions, current_user
│   ├── models/
│   │   ├── database.py      # SQLAlchemy async models
│   │   └── schemas.py       # Pydantic request/response
│   ├── routers/
│   │   ├── health.py
│   │   ├── auth.py
│   │   ├── dashboard.py
│   │   └── rag.py
│   ├── services/
│   │   ├── mcp_client.py    # MCP server proxy
│   │   ├── perplexity.py    # LLM client
│   │   └── cache.py         # Response caching
│   └── middleware/
│       ├── auth.py          # JWT verification
│       ├── rate_limit.py
│       └── logging.py
├── alembic/
├── tests/
├── Dockerfile
└── requirements.txt
```

## Application Factory

Always use the factory pattern. Never create `app = FastAPI()` at module level.

```python
# app/main.py
from fastapi import FastAPI
from app.config import get_settings
from app.routers import health, auth, dashboard, rag

def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="FPnA Insights API",
        version="1.0.0",
        docs_url="/api/docs" if settings.debug else None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type"],
    )

    app.include_router(health.router, prefix="/api/v1")
    app.include_router(auth.router, prefix="/api/v1")
    app.include_router(dashboard.router, prefix="/api/v1")
    app.include_router(rag.router, prefix="/api/v1")

    return app

app = create_app()
```

## Configuration

Use `pydantic-settings` for all config. Never hardcode secrets.

```python
# app/config.py
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    debug: bool = False
    database_url: str
    perplexity_api_key: str
    mcp_server_url: str = "http://mcp:8000"
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60
    cors_origins: list[str] = ["http://localhost:3000"]
    redis_url: str | None = None

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

@lru_cache
def get_settings() -> Settings:
    return Settings()
```

## Router Pattern

Every router follows this structure:

```python
# app/routers/rag.py
from fastapi import APIRouter, Depends
from app.dependencies import get_current_user, get_db
from app.models.schemas import RAGQueryRequest, RAGQueryResponse
from app.services.perplexity import PerplexityService
from app.services.mcp_client import MCPClient

router = APIRouter(prefix="/rag", tags=["RAG"])

@router.post("/query", response_model=RAGQueryResponse)
async def rag_query(
    request: RAGQueryRequest,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    mcp_data = await MCPClient().query(request.query, request.tables)
    llm_response = await PerplexityService().generate(
        query=request.query,
        context=mcp_data,
    )
    return RAGQueryResponse(
        postgres_data=mcp_data,
        llm_response=llm_response,
        sources=["Postgres MCP", "Perplexity Sonar"],
    )
```

## Pydantic Schemas

Strict validation on all inputs and outputs.

```python
# app/models/schemas.py
from pydantic import BaseModel, Field

class RAGQueryRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=500)
    context: str = "Financial Dashboard"
    tables: list[str] = Field(
        default=["financials_pl", "opex_by_dept", "payroll"],
        max_length=10,
    )

class RAGQueryResponse(BaseModel):
    postgres_data: dict
    llm_response: str
    sources: list[str]

class KPIResponse(BaseModel):
    label: str
    value: float
    formatted_value: str
    change_pct: float
    period: str
```

## Health Checks

Always include health endpoints. They are excluded from auth.

```python
# app/routers/health.py
from fastapi import APIRouter, Depends
from app.dependencies import get_db

router = APIRouter(prefix="/health", tags=["Health"])

@router.get("")
async def health():
    return {"status": "healthy"}

@router.get("/db")
async def health_db(db=Depends(get_db)):
    await db.execute("SELECT 1")
    return {"status": "healthy", "database": "connected"}
```

## Dependencies

```python
# app/dependencies.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from app.config import get_settings

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    settings = get_settings()
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        return payload
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
```

## Service Layer

Wrap external integrations in service classes for testability.

```python
# app/services/perplexity.py
import httpx
from app.config import get_settings

class PerplexityService:
    SYSTEM_PROMPT = (
        "You are an FP&A AI assistant. Analyze financial data and format "
        "responses with KPI summaries, variance analysis (green for favorable, "
        "red for unfavorable), and actionable recommendations."
    )

    async def generate(self, query: str, context: dict) -> str:
        settings = get_settings()
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.perplexity.ai/chat/completions",
                json={
                    "model": "sonar",
                    "messages": [
                        {"role": "system", "content": self.SYSTEM_PROMPT},
                        {"role": "user", "content": f"Query: {query}\nData: {context}"},
                    ],
                },
                headers={"Authorization": f"Bearer {settings.perplexity_api_key}"},
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]
```

## Requirements

```
fastapi>=0.115
uvicorn[standard]>=0.30
pydantic>=2.9
pydantic-settings>=2.5
httpx>=0.27
asyncpg>=0.30
sqlalchemy[asyncio]>=2.0
alembic>=1.13
python-jose[cryptography]>=3.3
passlib[bcrypt]>=1.7
python-multipart>=0.0.9
structlog>=24.1
pytest>=8.0
pytest-asyncio>=0.24
httpx  # also used as test client
```

## Dockerfile

```dockerfile
FROM python:3.12-slim AS base
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM base AS production
COPY . .
EXPOSE 8001
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
```

## Testing

```python
# tests/conftest.py
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import create_app

@pytest.fixture
def app():
    return create_app()

@pytest.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
```

## Key Rules

1. **Never hardcode secrets** -- all secrets via `Settings`
2. **Always version API routes** -- prefix with `/api/v1/`
3. **Always validate inputs** -- use Pydantic `Field` constraints
4. **Always use async** -- `asyncpg`, `httpx.AsyncClient`
5. **Always add timeout** -- `httpx.AsyncClient(timeout=30.0)`
6. **Service classes are stateless** -- no instance state, just methods
7. **Log with structlog** -- not `print()`
