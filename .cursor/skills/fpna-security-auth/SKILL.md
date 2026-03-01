---
name: fpna-security-auth
description: Implement authentication, authorization, secrets management, rate limiting, and security hardening for FPnA Insights PRO. Use when working with login, JWT tokens, CORS, API keys, environment variables, input validation, or audit logging.
---

# FPnA Security & Authentication

## Project Context

FPnA Insights PRO handles sensitive financial data. Security requirements:
- JWT-based authentication for all API routes (except health checks)
- Role-based access control (admin, analyst, viewer)
- Secrets managed via environment variables (never hardcoded)
- Audit trail for all RAG / data queries
- Rate limiting on API endpoints
- Input sanitization for LLM queries

## Authentication Flow

```
1. User submits email + password to POST /api/v1/auth/login
2. Backend verifies credentials against bcrypt hash in `users` table
3. Backend issues JWT token (HS256, 60min expiry)
4. Frontend stores token in memory (not localStorage for XSS safety)
5. Frontend sends token in Authorization header on every API request
6. Backend middleware validates token on protected routes
7. Token refresh via POST /api/v1/auth/refresh
```

## Auth Router

```python
# app/routers/auth.py
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from jose import jwt
from app.config import get_settings
from app.dependencies import get_db

router = APIRouter(prefix="/auth", tags=["Auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int

@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db=Depends(get_db)):
    user = await db.fetch_one(
        "SELECT id, email, hashed_password, role, is_active FROM users WHERE email = $1",
        req.email,
    )
    if not user or not pwd_context.verify(req.password, user["hashed_password"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    if not user["is_active"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account disabled")

    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    token = jwt.encode(
        {"sub": str(user["id"]), "email": user["email"], "role": user["role"], "exp": expire},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    return TokenResponse(access_token=token, expires_in=settings.jwt_expire_minutes * 60)
```

## CORS Configuration

Never use wildcard origins in production.

```python
# In app/main.py create_app()
from app.config import get_settings

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,  # ["http://localhost:3000"] in dev
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
```

Environment config:
```bash
# .env (development)
CORS_ORIGINS=["http://localhost:3000"]

# .env (production)
CORS_ORIGINS=["https://your-app.vercel.app"]
```

## Rate Limiting

Use `slowapi` for endpoint-level rate limiting.

```python
# app/middleware/rate_limit.py
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
```

Apply to sensitive endpoints:

```python
# In rag router
from app.middleware.rate_limit import limiter

@router.post("/query")
@limiter.limit("10/minute")
async def rag_query(request: Request, ...):
    ...
```

Add `slowapi` to requirements:
```
slowapi>=0.1.9
```

## Input Sanitization

Validate and constrain all user inputs before passing to MCP or LLM.

```python
# app/models/schemas.py
from pydantic import BaseModel, Field, field_validator
import re

ALLOWED_TABLES = {"financials_pl", "opex_by_dept", "payroll"}

class RAGQueryRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=500)
    tables: list[str] = Field(default=["financials_pl", "opex_by_dept", "payroll"])

    @field_validator("query")
    @classmethod
    def sanitize_query(cls, v: str) -> str:
        dangerous_patterns = [
            r";\s*DROP\s+",
            r";\s*DELETE\s+",
            r";\s*UPDATE\s+",
            r";\s*INSERT\s+",
            r"--",
            r"/\*",
        ]
        for pattern in dangerous_patterns:
            if re.search(pattern, v, re.IGNORECASE):
                raise ValueError("Query contains potentially dangerous SQL patterns")
        return v.strip()

    @field_validator("tables")
    @classmethod
    def validate_tables(cls, v: list[str]) -> list[str]:
        invalid = set(v) - ALLOWED_TABLES
        if invalid:
            raise ValueError(f"Invalid tables: {invalid}")
        return v
```

## Audit Logging

Log every financial data query for compliance.

```python
# app/services/audit.py
from app.dependencies import get_db

async def log_query(user_id: int, query: str, tables: list[str], response_summary: str):
    db = get_db()
    await db.execute(
        """INSERT INTO query_audit_log (user_id, query_text, tables_accessed, response_summary)
           VALUES ($1, $2, $3, $4)""",
        user_id, query, tables, response_summary[:500],
    )
```

## Secrets Checklist

Before any commit or deployment, verify:

- [ ] No API keys in source code (search for `pplx-`, `sk-`, `Bearer`)
- [ ] No passwords in docker-compose.yml (use `${VAR}` substitution)
- [ ] `.env` is in `.gitignore`
- [ ] `.env.example` exists with placeholder values
- [ ] JWT secret is at least 32 bytes of randomness
- [ ] Database password is not `password` or `postgres`

Generate a secure JWT secret:
```bash
openssl rand -hex 32
```

## Frontend Auth

```typescript
// lib/auth.ts
let accessToken: string | null = null;

export function setToken(token: string) {
  accessToken = token;
}

export function getToken(): string | null {
  return accessToken;
}

export function clearToken() {
  accessToken = null;
}

export function isAuthenticated(): boolean {
  if (!accessToken) return false;
  try {
    const payload = JSON.parse(atob(accessToken.split(".")[1]));
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}
```

Store tokens in memory, not `localStorage`. Use a React context to share auth state.

## Key Rules

1. **Never hardcode secrets** -- always use environment variables
2. **Never use `allow_origins=["*"]`** in production CORS
3. **Always hash passwords with bcrypt** -- never store plaintext
4. **Always validate and sanitize** user inputs before MCP/LLM calls
5. **Always audit-log** financial data queries
6. **JWT tokens in memory** -- not localStorage (XSS protection)
7. **Rate limit** RAG endpoints (expensive LLM calls)
8. **Health check endpoints** are the only unauthenticated routes
