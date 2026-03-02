---
name: fpna-deploy-vercel
description: Deploy FPnA Insights PRO to Vercel (frontend) and Fly.io (backend) with Neon PostgreSQL. Use when deploying, shipping to production, setting up Vercel, configuring Fly.io, or connecting Neon database for the FPnA application.
---

# FPnA Deploy to Vercel + Fly.io + Neon

## Architecture

```
                   ┌─────────────┐
  Users ──────────>│   Vercel    │  (Next.js frontend)
                   │  port 3000  │
                   └──────┬──────┘
                          │ NEXT_PUBLIC_API_URL
                          ▼
                   ┌─────────────┐
                   │   Fly.io    │  (FastAPI backend)
                   │  port 8080  │
                   └──────┬──────┘
                          │ DATABASE_URL
                          ▼
                   ┌─────────────┐
                   │    Neon     │  (PostgreSQL 16)
                   │  Serverless │
                   └─────────────┘
```

## Prerequisites

- Vercel account (free tier works)
- Fly.io account with `flyctl` CLI installed
- Neon account with a project (free tier works)
- Neon database seeded: `python db/seed_database.py --url "postgresql://..."`
- GitHub repo pushed (Vercel deploys from git)

## Deployment Checklist

```
- [ ] Step 1: Seed Neon database
- [ ] Step 2: Deploy backend to Fly.io
- [ ] Step 3: Deploy frontend to Vercel
- [ ] Step 4: Wire environment variables
- [ ] Step 5: Verify end-to-end
```

---

## Step 1: Seed Neon Database

Use the **direct** endpoint (not `-pooler`) for DDL operations:

```bash
python db/seed_database.py --url "postgresql://USER:PASS@ep-xxx.REGION.aws.neon.tech/neondb?sslmode=require"
```

If seeding hangs, kill stale sessions first (previous failed attempts leave locks):
```sql
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE datname = current_database() AND pid != pg_backend_pid();
```

Expected counts: general_ledger=2000, budget_forecast=48, users=1.

### Neon Connection Strings

| Component | Format |
|-----------|--------|
| Seed script | `postgresql://user:pass@ep-xxx.neon.tech/db?sslmode=require` |
| Backend | `postgresql+asyncpg://user:pass@ep-xxx.neon.tech/db?ssl=require` |

Key differences: asyncpg uses `ssl=require` (not `sslmode=require`), needs `+asyncpg` prefix, and does NOT support `channel_binding=require`.

---

## Step 2: Deploy Backend to Fly.io

### Install & Login

```bash
# Windows
powershell -Command "irm https://fly.io/install.ps1 | iex"

# Mac/Linux
curl -L https://fly.io/install.sh | sh

flyctl auth login
```

### Deploy

The `fly.toml` is in `backend/`. Deploy from that directory:

```bash
cd backend

# First time: create app and set secrets
flyctl apps create fpna-insights-api --org personal

flyctl secrets set \
  DATABASE_URL="postgresql+asyncpg://USER:PASS@ep-xxx.neon.tech/neondb?ssl=require" \
  JWT_SECRET="$(openssl rand -hex 32)" \
  OPENROUTER_API_KEY="sk-or-v1-your-key" \
  CORS_ORIGINS="https://your-app.vercel.app" \
  --app fpna-insights-api

flyctl deploy --app fpna-insights-api --remote-only
```

### Verify

```bash
curl https://fpna-insights-api.fly.dev/api/v1/health
# {"status":"healthy","service":"fpna-insights-api"}

curl https://fpna-insights-api.fly.dev/api/v1/health/db
# {"status":"healthy","database":"connected"}
```

### Key Config Notes

- `fly.toml` sets `PORT=8080` and `internal_port=8080`
- Machine: shared-cpu-1x, 512MB RAM, 1 uvicorn worker
- `auto_stop_machines = "stop"` — stops after inactivity, auto-starts on request
- Secrets are encrypted, never in code or logs
- `CORS_ORIGINS` accepts comma-separated URLs (not JSON array)

---

## Step 3: Deploy Frontend to Vercel

### Via Vercel CLI

```bash
cd frontend
npx vercel --yes --prod
```

### Via Vercel Dashboard

1. **New Project** > Import `gengirish/fpna-insights-pro`
2. **Root Directory**: `frontend`
3. **Framework**: Next.js
4. **Environment Variable**: `NEXT_PUBLIC_API_URL=https://fpna-insights-api.fly.dev`
5. Deploy

---

## Step 4: Wire Environment Variables

### On Fly.io (backend)

```bash
flyctl secrets set CORS_ORIGINS="https://your-app.vercel.app" --app fpna-insights-api
```

### On Vercel (frontend)

```bash
echo "https://fpna-insights-api.fly.dev" | npx vercel env add NEXT_PUBLIC_API_URL production --force
npx vercel --yes --prod   # redeploy to pick up new env
```

`NEXT_PUBLIC_` vars are baked in at build time — always redeploy after changing.

---

## Step 5: End-to-End Verification

```
1. Open https://your-app.vercel.app
2. Login: admin@fpna.local / admin123
3. Verify:
   - [ ] KPI cards show real numbers (Total Actual Spend ~$1.8M)
   - [ ] Budget vs Actual chart renders
   - [ ] Variance table shows all rows
   - [ ] AP/AR Aging tabs work
   - [ ] Ask AI button returns AI-powered analysis
```

---

## Troubleshooting

### CORS errors
Update `CORS_ORIGINS` on Fly.io to match the exact Vercel URL. No trailing slash.

### 502 Bad Gateway on Fly.io
Check `flyctl logs --app fpna-insights-api`. Common causes:
- OOM: Scale memory with `flyctl scale memory 512 --app fpna-insights-api`
- Port mismatch: Ensure PORT=8080 in fly.toml [env]

### Machine stopped
Fly.io auto-stops machines after inactivity. First request takes 2-5s to cold start. This is normal on free tier.

### Neon seeding hangs
Stale sessions from previous failed attempts hold locks. Terminate them first, then retry.

## Cost Summary

| Service | Plan | Cost |
|---------|------|------|
| Vercel | Hobby (free) | $0/mo |
| Fly.io | Free allowance | $0/mo (256MB shared CPU) |
| Neon | Free tier (0.5 GB) | $0/mo |
| **Total** | | **$0/mo** |

## Key Rules

1. **`NEXT_PUBLIC_` vars are build-time** — redeploy frontend after changing
2. **CORS must match exactly** — include `https://`, no trailing slash
3. **asyncpg uses `ssl=require`** — not `sslmode=require`
4. **Seed via direct endpoint** — not `-pooler` (DDL hangs on pooler)
5. **Never commit `.env`** — use `flyctl secrets set` and Vercel env vars
6. **Deploy backend from `backend/` dir** — that's where fly.toml lives
