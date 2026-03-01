---
name: fpna-devops-deploy
description: Configure Docker, Docker Compose, CI/CD pipelines, and production deployments for FPnA Insights PRO. Use when working with Dockerfiles, docker-compose, GitHub Actions, Vercel, Fly.io, or deployment configuration.
---

# FPnA DevOps & Deployment

## Project Context

FPnA Insights PRO deploys as:
- **Local dev**: Docker Compose (Postgres + MCP + Backend + Frontend)
- **Production**: Vercel (frontend) + Render (backend) + Supabase/Neon (Postgres)
- **CI/CD**: GitHub Actions (lint, test, build, deploy)

## Docker Compose (Development)

Do NOT use the deprecated `version:` key. Use env variable substitution for secrets.

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-fpna_insights}
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./db/init.sql:/docker-entrypoint-initdb.d/01-init.sql
      - ./db/seed.sql:/docker-entrypoint-initdb.d/02-seed.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      target: production
    ports:
      - "8001:8001"
    env_file: .env
    environment:
      DATABASE_URL: postgresql+asyncpg://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-fpna_insights}
      MCP_SERVER_URL: http://mcp:8000
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8001/api/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build:
      context: ./frontend
      target: runner
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8001
    depends_on:
      - backend

volumes:
  postgres_data:
```

## Backend Dockerfile (Multi-Stage)

```dockerfile
# backend/Dockerfile
FROM python:3.12-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM base AS production
COPY . .
EXPOSE 8001
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2"]
```

## Frontend Dockerfile (Multi-Stage)

```dockerfile
# frontend/Dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

Requires `output: "standalone"` in `next.config.ts`:

```typescript
// next.config.ts
const nextConfig = {
  output: "standalone",
};
export default nextConfig;
```

## Environment Variables Template

```bash
# .env.example

# Database
POSTGRES_DB=fpna_insights
POSTGRES_USER=postgres
POSTGRES_PASSWORD=          # REQUIRED: set a strong password

# Backend
DATABASE_URL=postgresql+asyncpg://postgres:YOUR_PASSWORD@localhost:5432/fpna_insights
JWT_SECRET=                 # REQUIRED: generate with `openssl rand -hex 32`
PERPLEXITY_API_KEY=         # REQUIRED: your Perplexity API key
MCP_SERVER_URL=http://localhost:8000
CORS_ORIGINS=["http://localhost:3000"]
DEBUG=true

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8001
```

## GitHub Actions CI

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: fpna_test
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: testpassword
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install -r backend/requirements.txt
      - run: python -m pytest backend/tests/ -v
        env:
          DATABASE_URL: postgresql+asyncpg://postgres:testpassword@localhost:5432/fpna_test
          JWT_SECRET: test-secret-key
          PERPLEXITY_API_KEY: test-key

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm ci
        working-directory: frontend
      - run: npm run lint
        working-directory: frontend
      - run: npm run build
        working-directory: frontend
        env:
          NEXT_PUBLIC_API_URL: http://localhost:8001
```

## Production Deployment Targets

### Frontend -> Vercel

```bash
cd frontend
npx vercel --prod
```

Set environment variables in Vercel dashboard:
- `NEXT_PUBLIC_API_URL` = your Render backend URL (e.g., `https://fpna-api.onrender.com`)

### Backend -> Render

Create a `render.yaml` (Blueprint):

```yaml
# render.yaml
services:
  - type: web
    name: fpna-api
    runtime: docker
    dockerfilePath: backend/Dockerfile
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: fpna-db
          property: connectionString
      - key: JWT_SECRET
        generateValue: true
      - key: PERPLEXITY_API_KEY
        sync: false
      - key: CORS_ORIGINS
        value: '["https://your-app.vercel.app"]'

databases:
  - name: fpna-db
    plan: starter
```

### Database -> Supabase or Neon

For production Postgres, use Supabase (free tier) or Neon (serverless). Both provide connection pooling.

Set `DATABASE_URL` in Render to the Supabase/Neon connection string.

## .gitignore

```gitignore
# Python
__pycache__/
*.pyc
.venv/
*.egg-info/

# Node
node_modules/
.next/
out/

# Environment
.env
.env.local
.env.production

# Docker
postgres_data/

# IDE
.vscode/
.idea/
```

## Key Rules

1. **Never use `version:` in Docker Compose** -- it's deprecated
2. **Always use health checks** for services that others depend on
3. **Always use multi-stage builds** -- keep production images small
4. **Never commit `.env`** -- only `.env.example`
5. **Always pin major versions** of base images (`postgres:16-alpine`, `node:20-alpine`, `python:3.12-slim`)
6. **Always use `env_file`** in Docker Compose for secrets
7. **Frontend must use `output: "standalone"`** for Docker deployment
8. **CI must run tests against a real Postgres** -- not SQLite
