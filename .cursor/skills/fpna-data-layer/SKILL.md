---
name: fpna-data-layer
description: Set up and maintain the PostgreSQL database, Alembic migrations, seed data, and MCP server integration for the FPnA Insights PRO application. Use when working with database schemas, migrations, SQL queries, seed data, or MCP server configuration.
---

# FPnA Data Layer

## Project Context

FPnA Insights PRO uses PostgreSQL as its primary data store with three core tables: `financials_pl` (P&L), `opex_by_dept` (operating expenses), and `payroll`. Data is accessed via a Postgres MCP server and directly via asyncpg/SQLAlchemy.

## Database Schema

```sql
-- db/init.sql

CREATE TABLE IF NOT EXISTS financials_pl (
    id SERIAL PRIMARY KEY,
    period VARCHAR(10) NOT NULL,         -- 'Q1-2025', 'Q2-2025'
    metric VARCHAR(100) NOT NULL,        -- 'Revenue', 'COGS', 'Gross Profit', 'Net Income'
    actual NUMERIC(15, 2) NOT NULL,
    budget NUMERIC(15, 2) NOT NULL,
    variance_pct NUMERIC(8, 4) GENERATED ALWAYS AS (
        CASE WHEN budget != 0 THEN ((actual - budget) / budget) * 100 ELSE 0 END
    ) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS opex_by_dept (
    id SERIAL PRIMARY KEY,
    period VARCHAR(10) NOT NULL,
    department VARCHAR(100) NOT NULL,    -- 'Engineering', 'Sales', 'Marketing', 'G&A'
    category VARCHAR(100) NOT NULL,      -- 'Salaries', 'Software', 'Travel', 'Facilities'
    actual NUMERIC(15, 2) NOT NULL,
    budget NUMERIC(15, 2) NOT NULL,
    variance_pct NUMERIC(8, 4) GENERATED ALWAYS AS (
        CASE WHEN budget != 0 THEN ((actual - budget) / budget) * 100 ELSE 0 END
    ) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll (
    id SERIAL PRIMARY KEY,
    period VARCHAR(10) NOT NULL,
    department VARCHAR(100) NOT NULL,
    headcount INTEGER NOT NULL,
    total_compensation NUMERIC(15, 2) NOT NULL,
    benefits_cost NUMERIC(15, 2) NOT NULL,
    cost_per_head NUMERIC(12, 2) GENERATED ALWAYS AS (
        CASE WHEN headcount != 0 THEN (total_compensation + benefits_cost) / headcount ELSE 0 END
    ) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'viewer',   -- 'admin', 'analyst', 'viewer'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS query_audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    query_text TEXT NOT NULL,
    tables_accessed TEXT[],
    response_summary TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_financials_period ON financials_pl(period);
CREATE INDEX idx_opex_period_dept ON opex_by_dept(period, department);
CREATE INDEX idx_payroll_period ON payroll(period);
CREATE INDEX idx_audit_user ON query_audit_log(user_id, created_at);
```

## Seed Data

Provide realistic FP&A seed data. Always include multiple periods for trend analysis.

```sql
-- db/seed.sql

INSERT INTO financials_pl (period, metric, actual, budget) VALUES
('Q1-2025', 'Revenue',       10250000, 10500000),
('Q1-2025', 'COGS',           4100000,  4200000),
('Q1-2025', 'Gross Profit',   6150000,  6300000),
('Q1-2025', 'OPEX',           4200000,  4000000),
('Q1-2025', 'Net Income',     1950000,  2300000),
('Q2-2025', 'Revenue',       11100000, 10800000),
('Q2-2025', 'COGS',           4350000,  4320000),
('Q2-2025', 'Gross Profit',   6750000,  6480000),
('Q2-2025', 'OPEX',           4100000,  4100000),
('Q2-2025', 'Net Income',     2650000,  2380000),
('Q3-2025', 'Revenue',       10800000, 11000000),
('Q3-2025', 'COGS',           4400000,  4400000),
('Q3-2025', 'Gross Profit',   6400000,  6600000),
('Q3-2025', 'OPEX',           4300000,  4150000),
('Q3-2025', 'Net Income',     2100000,  2450000),
('Q4-2025', 'Revenue',       12500000, 12000000),
('Q4-2025', 'COGS',           4800000,  4800000),
('Q4-2025', 'Gross Profit',   7700000,  7200000),
('Q4-2025', 'OPEX',           4500000,  4400000),
('Q4-2025', 'Net Income',     3200000,  2800000);

INSERT INTO opex_by_dept (period, department, category, actual, budget) VALUES
('Q1-2025', 'Engineering', 'Salaries',    1200000, 1150000),
('Q1-2025', 'Engineering', 'Software',     180000,  200000),
('Q1-2025', 'Sales',       'Salaries',     800000,  780000),
('Q1-2025', 'Sales',       'Travel',       120000,  100000),
('Q1-2025', 'Marketing',   'Campaigns',    350000,  400000),
('Q1-2025', 'Marketing',   'Software',      80000,   75000),
('Q1-2025', 'G&A',         'Facilities',   250000,  240000),
('Q1-2025', 'G&A',         'Legal',        150000,  120000);

INSERT INTO payroll (period, department, headcount, total_compensation, benefits_cost) VALUES
('Q1-2025', 'Engineering', 45, 1200000, 240000),
('Q1-2025', 'Sales',       30,  800000, 160000),
('Q1-2025', 'Marketing',   15,  420000,  84000),
('Q1-2025', 'G&A',         12,  380000,  76000),
('Q2-2025', 'Engineering', 48, 1300000, 260000),
('Q2-2025', 'Sales',       32,  850000, 170000),
('Q2-2025', 'Marketing',   16,  450000,  90000),
('Q2-2025', 'G&A',         12,  385000,  77000);

INSERT INTO users (email, hashed_password, full_name, role) VALUES
('admin@fpna.local', '$2b$12$placeholder_hash_replace_me', 'Admin User', 'admin');
```

## Alembic Setup

```ini
# alembic.ini (key settings)
[alembic]
script_location = alembic
sqlalchemy.url = %(DATABASE_URL)s
```

```python
# alembic/env.py
import os
from alembic import context
from sqlalchemy import create_engine

def run_migrations_online():
    url = os.environ["DATABASE_URL"]
    engine = create_engine(url)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=None)
        with context.begin_transaction():
            context.run_migrations()

run_migrations_online()
```

## SQLAlchemy Async Models

```python
# app/models/database.py
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.config import get_settings

def get_engine():
    settings = get_settings()
    return create_async_engine(settings.database_url, echo=settings.debug)

def get_session_factory():
    return async_sessionmaker(get_engine(), class_=AsyncSession, expire_on_commit=False)
```

## MCP Client

The MCP client proxies queries to the Postgres MCP server. Always set timeouts and handle failures gracefully.

```python
# app/services/mcp_client.py
import httpx
from app.config import get_settings

class MCPClient:
    async def query(self, query: str, tables: list[str]) -> dict:
        settings = get_settings()
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{settings.mcp_server_url}/mcp/query",
                json={"query": query, "tables": tables},
            )
            resp.raise_for_status()
            return resp.json()
```

## Docker Compose (Database + MCP)

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-fpna_insights}
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
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
```

## Key Rules

1. **Always use generated columns** for calculated fields (variance_pct, cost_per_head)
2. **Always add indexes** on columns used in WHERE/JOIN clauses
3. **Always include `created_at`** timestamps on every table
4. **Always use `NUMERIC`** for financial values -- never `FLOAT`
5. **Always use parameterized queries** -- never string interpolation for SQL
6. **Seed data must be realistic** -- use amounts that make financial sense
7. **MCP client must have timeouts** -- default 15 seconds
8. **Use `docker-entrypoint-initdb.d/`** for automatic schema + seed on first run
