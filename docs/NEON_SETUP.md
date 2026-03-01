# Neon PostgreSQL Setup Guide

End-to-end configuration for running FPnA Insights PRO against [Neon](https://neon.tech) serverless Postgres.

---

## 1. Create a Neon Project

1. Go to [console.neon.tech](https://console.neon.tech)
2. Click **New Project**
3. Settings:
   - **Name**: `fpna-insights-pro`
   - **Region**: Choose closest to your users (e.g. `us-east-2`)
   - **Postgres version**: `16`
   - **Plan**: Free tier works for development (0.5 GB storage, 190 compute hours/month)
4. Click **Create Project**

## 2. Get Connection String

After project creation, Neon shows your connection details. Copy the connection string:

```
postgresql://neondb_owner:AbCdEf123456@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
```

You'll need two variants:

| Use | Format | Example |
|-----|--------|---------|
| **Seed script** (psycopg2) | `postgresql://...` | `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require` |
| **FastAPI** (asyncpg) | `postgresql+asyncpg://...` | `postgresql+asyncpg://user:pass@ep-xxx.neon.tech/neondb?ssl=require` |

Note: asyncpg uses `ssl=require` not `sslmode=require`.

## 3. Configure Environment

Add to your `.env` file:

```bash
# Neon connection (for seed script)
NEON_DATABASE_URL=postgresql://neondb_owner:YOUR_PASSWORD@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require

# Backend connection (asyncpg format)
DATABASE_URL=postgresql+asyncpg://neondb_owner:YOUR_PASSWORD@ep-xxx.us-east-2.aws.neon.tech/neondb?ssl=require
```

## 4. Initialize Schema + Seed Data

The Python seed script works with any PostgreSQL -- Docker or Neon:

```bash
# Option A: Use --neon flag (reads NEON_DATABASE_URL from .env)
python db/seed_database.py --neon

# Option B: Explicit URL
python db/seed_database.py --url "postgresql://neondb_owner:YOUR_PASSWORD@ep-xxx.neon.tech/neondb?sslmode=require"

# Schema only (no data)
python db/seed_database.py --neon --schema-only

# Data only (schema already exists)
python db/seed_database.py --neon --data-only
```

Expected output:
```
Connecting to: ...@ep-xxx.us-east-2.aws.neon.tech/neondb
Connected successfully.

  Creating schema...
  Schema created.

Seeding data...
  general_ledger: 2000 rows inserted
  accounts_payable: 800 rows inserted
  accounts_receivable: 900 rows inserted
  budget_forecast: 48 rows inserted
  expense_claims: 1000 rows inserted
  Admin user created (admin@fpna.local / admin123)

--- Verification ---
  general_ledger: 2000 rows
  accounts_payable: 800 rows
  accounts_receivable: 900 rows
  budget_forecast: 48 rows
  expense_claims: 1000 rows
  users: 1 rows

Done! Database is ready.
```

## 5. Run Backend Against Neon

Update `.env` so `DATABASE_URL` points to Neon:

```bash
DATABASE_URL=postgresql+asyncpg://neondb_owner:YOUR_PASSWORD@ep-xxx.us-east-2.aws.neon.tech/neondb?ssl=require
```

Then start the backend:

```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

## 6. End-to-End Test Checklist

Run these against the Neon-backed API:

```bash
# 1. Health check
curl http://localhost:8001/api/v1/health
# Expected: {"status":"healthy","service":"fpna-insights-api"}

# 2. DB health check
curl http://localhost:8001/api/v1/health/db
# Expected: {"status":"healthy","database":"connected"}

# 3. Login
curl -X POST http://localhost:8001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@fpna.local","password":"admin123"}'
# Expected: {"access_token":"eyJ...","token_type":"bearer",...}

# 4. Dashboard summary (use token from step 3)
curl http://localhost:8001/api/v1/dashboard/summary?fiscal_year=2025 \
  -H "Authorization: Bearer <TOKEN>"
# Expected: KPIs, budget_vs_actual, dept_breakdown with real data

# 5. AP Aging
curl http://localhost:8001/api/v1/dashboard/ap-aging \
  -H "Authorization: Bearer <TOKEN>"

# 6. AR Aging
curl http://localhost:8001/api/v1/dashboard/ar-aging \
  -H "Authorization: Bearer <TOKEN>"

# 7. GL Summary
curl http://localhost:8001/api/v1/dashboard/gl-summary \
  -H "Authorization: Bearer <TOKEN>"

# 8. Expense Summary
curl http://localhost:8001/api/v1/dashboard/expense-summary \
  -H "Authorization: Bearer <TOKEN>"

# 9. RAG Query
curl -X POST http://localhost:8001/api/v1/rag/query \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"query":"What is the budget variance for Marketing in Q2 2025?"}'
```

## 7. Switching Between Local and Neon

The seed script and backend both read from `.env`. To switch:

### Use Local Docker
```bash
DATABASE_URL=postgresql+asyncpg://postgres:changeme@localhost:5433/fpna_insights
```

### Use Neon
```bash
DATABASE_URL=postgresql+asyncpg://neondb_owner:PASSWORD@ep-xxx.neon.tech/neondb?ssl=require
```

Restart the backend after changing `DATABASE_URL`.

## 8. Neon-Specific Considerations

### Connection Pooling
Neon provides built-in connection pooling. Use the pooled connection string (port 5432 endpoint) for production to avoid connection limits.

### Cold Starts
Neon's free tier suspends compute after 5 minutes of inactivity. First request after inactivity may take 1-3 seconds. For production, enable **Always On** compute ($0.25/hr).

### SSL Required
Neon always requires SSL. Ensure your connection string includes:
- psycopg2: `?sslmode=require`
- asyncpg: `?ssl=require`

### Branching (Optional)
Neon supports database branching -- instant copy-on-write clones:
```bash
# Create a dev branch from main
neonctl branches create --name dev --project-id <project-id>
```
Useful for testing schema changes without affecting production data.

## 9. Production Deployment with Neon

For deploying to Render/Railway/Fly.io:

1. Create a Neon production branch (or use main)
2. Set `DATABASE_URL` as an environment variable in your hosting platform
3. Run `python db/seed_database.py --url "$DATABASE_URL"` once to initialize
4. Deploy the backend container

The connection string format for hosted platforms:
```
postgresql+asyncpg://user:password@ep-xxx.neon.tech/dbname?ssl=require
```
