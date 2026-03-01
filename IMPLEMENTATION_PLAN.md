# FPnA Insights PRO -- Implementation Plan

## Overview

A production-grade FP&A dashboard combining **FastAPI** (backend), **NextJS 15** (frontend), **PostgreSQL** (data), and **Perplexity Sonar** (RAG). This plan addresses all gaps identified in the original spec and defines a phased buildout.

---

## Architecture (Revised)

```
fpna-insights-pro/
├── .cursor/skills/              # Agent skills for guided implementation
├── .github/workflows/           # CI/CD pipelines
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI application factory
│   │   ├── config.py            # Pydantic Settings (env-based config)
│   │   ├── dependencies.py      # Shared dependencies (DB session, auth)
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── database.py      # SQLAlchemy / asyncpg models
│   │   │   └── schemas.py       # Pydantic request/response schemas
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── health.py        # Health check endpoints
│   │   │   ├── auth.py          # Authentication routes
│   │   │   ├── dashboard.py     # Dashboard data endpoints
│   │   │   └── rag.py           # RAG query endpoints
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── mcp_client.py    # MCP server integration
│   │   │   ├── perplexity.py    # Perplexity API client
│   │   │   └── cache.py         # Redis/in-memory caching
│   │   └── middleware/
│   │       ├── __init__.py
│   │       ├── auth.py          # JWT middleware
│   │       ├── rate_limit.py    # Rate limiting
│   │       └── logging.py       # Structured logging
│   ├── alembic/                 # Database migrations
│   │   ├── env.py
│   │   └── versions/
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_health.py
│   │   ├── test_rag.py
│   │   └── test_dashboard.py
│   ├── alembic.ini
│   ├── Dockerfile
│   ├── requirements.txt
│   └── pyproject.toml
├── frontend/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx             # Landing / redirect
│   │   ├── login/page.tsx       # Auth page
│   │   └── dashboard/
│   │       ├── layout.tsx       # Dashboard shell (sidebar + topbar)
│   │       ├── page.tsx         # Financial overview
│   │       ├── opex/page.tsx    # OPEX analysis
│   │       └── payroll/page.tsx # Payroll analysis
│   ├── components/
│   │   ├── ui/                  # shadcn/ui primitives
│   │   ├── charts/              # Recharts wrappers
│   │   │   ├── revenue-chart.tsx
│   │   │   ├── opex-chart.tsx
│   │   │   └── kpi-card.tsx
│   │   ├── ask-ai/
│   │   │   ├── chat-dialog.tsx
│   │   │   ├── message-bubble.tsx
│   │   │   └── use-chat.ts     # Custom hook
│   │   └── layout/
│   │       ├── sidebar.tsx
│   │       ├── topbar.tsx
│   │       └── mobile-nav.tsx
│   ├── lib/
│   │   ├── api.ts              # API client with error handling
│   │   ├── auth.ts             # Auth utilities
│   │   └── utils.ts            # Shared utilities
│   ├── Dockerfile
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── package.json
├── db/
│   ├── init.sql                # Initial schema + seed data
│   └── seed/
│       ├── financials_pl.csv
│       ├── opex_by_dept.csv
│       └── payroll.csv
├── docker-compose.yml          # Local development
├── docker-compose.prod.yml     # Production overrides
├── .env.example                # Template for environment variables
├── .gitignore
└── README.md
```

---

## Phased Implementation

### Phase 1: Foundation (Day 1) -- Infrastructure + Data Layer

**Goal**: Running database with schema, migrations, and seed data.

| Step | Task | Skill |
|------|------|-------|
| 1.1 | Create `.env.example` with all required env vars | `fpna-security-auth` |
| 1.2 | Create PostgreSQL schema (`financials_pl`, `opex_by_dept`, `payroll`) | `fpna-data-layer` |
| 1.3 | Set up Alembic migrations | `fpna-data-layer` |
| 1.4 | Create seed data (CSV + SQL loader) | `fpna-data-layer` |
| 1.5 | Write `docker-compose.yml` with health checks | `fpna-devops-deploy` |
| 1.6 | Create Dockerfiles (multi-stage) for backend and frontend | `fpna-devops-deploy` |
| 1.7 | Verify: `docker compose up` starts Postgres + runs migrations | -- |

### Phase 2: Backend Core (Day 2) -- API + Services

**Goal**: FastAPI serving health, dashboard data, and RAG endpoints.

| Step | Task | Skill |
|------|------|-------|
| 2.1 | Create FastAPI app factory with proper config (`pydantic-settings`) | `fpna-fastapi-backend` |
| 2.2 | Implement health check router (`/health`, `/health/db`) | `fpna-fastapi-backend` |
| 2.3 | Implement dashboard data router (KPIs, time series from Postgres) | `fpna-fastapi-backend` |
| 2.4 | Implement MCP client service (query Postgres via MCP) | `fpna-data-layer` |
| 2.5 | Implement Perplexity service (RAG query with context injection) | `fpna-fastapi-backend` |
| 2.6 | Implement RAG router (`/api/v1/rag/query`) | `fpna-fastapi-backend` |
| 2.7 | Add structured logging middleware | `fpna-fastapi-backend` |
| 2.8 | Write tests (pytest + httpx AsyncClient) | `fpna-fastapi-backend` |
| 2.9 | Verify: All endpoints return correct responses | -- |

### Phase 3: Frontend Core (Day 3-4) -- Dashboard + AI Chat

**Goal**: Responsive NextJS dashboard with live data and AI chat.

| Step | Task | Skill |
|------|------|-------|
| 3.1 | Initialize Next.js 15 (stable) + Tailwind + shadcn/ui | `fpna-nextjs-dashboard` |
| 3.2 | Create API client (`lib/api.ts`) with env-based URL | `fpna-nextjs-dashboard` |
| 3.3 | Build layout shell (responsive sidebar + topbar) | `fpna-nextjs-dashboard` |
| 3.4 | Build KPI card components with real data fetching | `fpna-nextjs-dashboard` |
| 3.5 | Build chart components (Revenue trend, OPEX breakdown) | `fpna-nextjs-dashboard` |
| 3.6 | Build AI chat dialog with `use-chat` hook | `fpna-nextjs-dashboard` |
| 3.7 | Add error boundaries and loading skeletons | `fpna-nextjs-dashboard` |
| 3.8 | Mobile responsiveness pass | `fpna-nextjs-dashboard` |
| 3.9 | Verify: Dashboard renders with live backend data | -- |

### Phase 4: Security (Day 5) -- Auth + Hardening

**Goal**: Protected API with JWT auth, secrets management, rate limiting.

| Step | Task | Skill |
|------|------|-------|
| 4.1 | Implement JWT auth (login + token refresh) | `fpna-security-auth` |
| 4.2 | Add auth middleware to backend routes | `fpna-security-auth` |
| 4.3 | Add login page to frontend | `fpna-security-auth` |
| 4.4 | Configure CORS with explicit origins | `fpna-security-auth` |
| 4.5 | Add rate limiting middleware | `fpna-security-auth` |
| 4.6 | Add input sanitization for RAG queries | `fpna-security-auth` |
| 4.7 | Set up `.env` with proper secrets (no hardcoded values) | `fpna-security-auth` |
| 4.8 | Add audit logging for financial queries | `fpna-security-auth` |

### Phase 5: Production (Day 6-7) -- Deploy + CI/CD

**Goal**: Deployed to Vercel + Render with automated pipeline.

| Step | Task | Skill |
|------|------|-------|
| 5.1 | Create GitHub Actions CI pipeline (lint + test) | `fpna-devops-deploy` |
| 5.2 | Create production Docker Compose with SSL termination | `fpna-devops-deploy` |
| 5.3 | Deploy frontend to Vercel | `fpna-devops-deploy` |
| 5.4 | Deploy backend to Render | `fpna-devops-deploy` |
| 5.5 | Set up Supabase Postgres (or Neon) for production DB | `fpna-devops-deploy` |
| 5.6 | Configure environment variables in all platforms | `fpna-devops-deploy` |
| 5.7 | Smoke test production deployment | -- |

---

## Key Design Decisions

### 1. Async All the Way
Use `asyncpg` instead of `psycopg2-binary`. FastAPI is async-native; blocking the event loop with sync DB drivers defeats the purpose.

### 2. Application Factory Pattern
`create_app()` function instead of module-level `app = FastAPI()`. Enables testing with fresh app instances and environment-specific configuration.

### 3. Pydantic Settings for Config
All config via environment variables with `pydantic-settings`. No hardcoded values. `.env.example` documents every required variable.

### 4. API Versioning from Day 1
All routes under `/api/v1/`. Enables breaking changes later without disrupting existing clients.

### 5. Service Layer Abstraction
MCP and Perplexity behind service classes. Easy to swap LLM providers or mock in tests.

### 6. Responsive-First Frontend
Mobile sidebar collapses to hamburger menu. Charts resize with container queries. Dashboard is usable on tablet.

### 7. JWT + httpOnly Cookies
Tokens stored in httpOnly cookies (not localStorage). Prevents XSS token theft.

---

## Success Criteria

- [ ] `docker compose up` brings up entire stack in < 60 seconds
- [ ] All API endpoints return correct responses with seed data
- [ ] Dashboard renders KPIs, charts, and AI chat on desktop and mobile
- [ ] No hardcoded secrets in source code
- [ ] All routes require authentication (except health check)
- [ ] CI pipeline passes (lint + tests) on every push
- [ ] Production deployment accessible at public URLs
