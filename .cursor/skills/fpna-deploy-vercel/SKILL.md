---
name: fpna-deploy-vercel
description: Deploy FPnA Insights PRO to Vercel (frontend) and Render (backend) with Neon PostgreSQL. Use when deploying, shipping to production, setting up Vercel, configuring Render, or connecting Neon database for the FPnA application.
---

# FPnA Deploy to Vercel + Render + Neon

## Architecture

```
                   ┌─────────────┐
  Users ──────────>│   Vercel    │  (Next.js frontend)
                   │  port 3000  │
                   └──────┬──────┘
                          │ NEXT_PUBLIC_API_URL
                          ▼
                   ┌─────────────┐
                   │   Render    │  (FastAPI backend)
                   │  port 8001  │
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
- Render account (free or Starter $7/mo)
- Neon account with a project (free tier works)
- Neon database seeded: `python db/seed_database.py --neon`
- GitHub repo pushed (Vercel and Render deploy from git)

## Deployment Checklist

```
- [ ] Step 1: Seed Neon database
- [ ] Step 2: Deploy backend to Render
- [ ] Step 3: Deploy frontend to Vercel
- [ ] Step 4: Wire environment variables
- [ ] Step 5: Verify end-to-end
```

---

## Step 1: Seed Neon Database

The seed script works with any Postgres. Use the direct endpoint (not pooler) for DDL:

```bash
python db/seed_database.py --url "postgresql://USER:PASS@ep-xxx.REGION.aws.neon.tech/neondb?sslmode=require"
```

Verify in the Neon console SQL Editor:
```sql
SELECT 'general_ledger' as t, count(*) FROM general_ledger
UNION ALL SELECT 'budget_forecast', count(*) FROM budget_forecast
UNION ALL SELECT 'users', count(*) FROM users;
```

Expected: general_ledger=2000, budget_forecast=48, users=1.

### Neon Connection Strings

You need two formats from the same Neon project:

| Component | Format | Use |
|-----------|--------|-----|
| Seed script | `postgresql://user:pass@ep-xxx.neon.tech/db?sslmode=require` | psycopg2 (sync) |
| Backend | `postgresql+asyncpg://user:pass@ep-xxx.neon.tech/db?ssl=require` | SQLAlchemy asyncpg |

Key difference: asyncpg uses `ssl=require` not `sslmode=require`, and needs the `+asyncpg` driver prefix.

If your Neon string includes `channel_binding=require`, keep it for the seed script but **remove it** for the asyncpg backend URL (asyncpg does not support channel_binding as a query parameter).

---

## Step 2: Deploy Backend to Render

### Option A: Via render.yaml (Blueprint)

The project includes `render.yaml` at the repo root. In Render dashboard:

1. **New** > **Blueprint**
2. Connect your GitHub repo
3. Render auto-detects `render.yaml` and creates the service
4. Set the manual env vars when prompted

### Option B: Manual Setup

1. **New** > **Web Service**
2. Connect GitHub repo
3. Settings:
   - **Name**: `fpna-insights-api`
   - **Region**: US East (match Neon region)
   - **Runtime**: Docker
   - **Docker Build Context**: `backend`
   - **Dockerfile Path**: `backend/Dockerfile`
4. Environment variables:

```
DATABASE_URL=postgresql+asyncpg://USER:PASS@ep-xxx.neon.tech/neondb?ssl=require
JWT_SECRET=<generate with: openssl rand -hex 32>
PERPLEXITY_API_KEY=<your key, or leave empty for data-only mode>
CORS_ORIGINS=["https://YOUR-APP.vercel.app"]
DEBUG=false
```

5. **Create Web Service**

After deploy, verify:
```bash
curl https://fpna-insights-api.onrender.com/api/v1/health
# {"status":"healthy","service":"fpna-insights-api"}

curl https://fpna-insights-api.onrender.com/api/v1/health/db
# {"status":"healthy","database":"connected"}
```

**Important**: Note the Render URL (e.g., `https://fpna-insights-api.onrender.com`). You need it for the Vercel frontend.

---

## Step 3: Deploy Frontend to Vercel

### Option A: Via Vercel CLI

```bash
cd frontend
npx vercel --prod
```

When prompted:
- **Link to existing project?** No
- **Project name**: `fpna-insights-pro`
- **Root directory**: `./` (we are already in frontend/)
- **Override settings?** No

### Option B: Via Vercel Dashboard

1. **New Project** > Import Git Repository
2. Settings:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
3. Environment Variables:

```
NEXT_PUBLIC_API_URL=https://fpna-insights-api.onrender.com
```

4. **Deploy**

### next.config.ts Requirements

The frontend `next.config.ts` must have `output: "standalone"` for Docker, but Vercel ignores this and uses its own builder. No changes needed.

---

## Step 4: Wire Environment Variables

After both services are deployed, cross-link them:

### On Render (backend)

Update `CORS_ORIGINS` to include the actual Vercel URL:

```
CORS_ORIGINS=["https://fpna-insights-pro.vercel.app"]
```

If your Vercel URL is different (e.g., custom domain), update accordingly.

### On Vercel (frontend)

Ensure `NEXT_PUBLIC_API_URL` points to the Render backend:

```
NEXT_PUBLIC_API_URL=https://fpna-insights-api.onrender.com
```

Redeploy frontend after changing env vars (Vercel > Project > Settings > Environment Variables > redeploy).

---

## Step 5: End-to-End Verification

```
1. Open https://fpna-insights-pro.vercel.app
2. Login: admin@fpna.local / admin123
3. Verify:
   - [ ] KPI cards show real numbers (Total Actual Spend ~$1.8M)
   - [ ] Budget vs Actual chart renders with 6 departments
   - [ ] Dept pie chart shows Marketing as largest spend
   - [ ] Variance table shows all 24 rows (6 depts x 4 quarters)
   - [ ] AP Aging tab shows aging buckets
   - [ ] AR Aging tab shows aging buckets
   - [ ] Expenses tab shows by-category and by-status
   - [ ] General Ledger tab shows account summary
   - [ ] Ask AI button opens chat dialog
   - [ ] AI query returns response (or data summary if no Perplexity key)
```

---

## Troubleshooting

### CORS errors in browser console

The browser shows `Access-Control-Allow-Origin` errors.

**Fix**: Update `CORS_ORIGINS` on Render to match the exact Vercel URL (including `https://`). Redeploy the backend.

### 401 Unauthorized on dashboard

JWT token expired or invalid.

**Fix**: The Render backend and local backend must use the same `JWT_SECRET` if you generated tokens locally. Safest: just login again on the production frontend.

### Database connection timeout on Render

Neon free tier suspends after 5 min. First request after suspend takes 1-3s.

**Fix**: For production, enable Neon **Always On** compute. Or accept the cold start delay.

### Frontend shows blank page

`NEXT_PUBLIC_API_URL` not set or wrong.

**Fix**: Vercel > Project > Settings > Environment Variables. Must be set at **build time** (not runtime) because `NEXT_PUBLIC_` vars are inlined during build. Redeploy after changing.

### Render build fails

Usually a Dockerfile issue or missing dependency.

**Fix**: Test Docker build locally first:
```bash
cd backend
docker build -t fpna-api .
docker run -p 8001:8001 --env-file ../.env fpna-api
```

---

## Cost Summary

| Service | Plan | Cost |
|---------|------|------|
| Vercel | Hobby (free) | $0/mo |
| Render | Free / Starter | $0-7/mo |
| Neon | Free tier (0.5 GB) | $0/mo |
| **Total** | | **$0-7/mo** |

Free tier limitations:
- **Render free**: Spins down after 15 min inactivity (50s cold start)
- **Neon free**: Suspends after 5 min inactivity (1-3s cold start), 0.5 GB storage
- **Vercel hobby**: 100 GB bandwidth, no commercial use

For production: Render Starter ($7/mo) + Neon Launch ($19/mo) eliminates cold starts.

## Key Rules

1. **`NEXT_PUBLIC_` vars are build-time** -- redeploy frontend after changing them
2. **CORS must match exactly** -- `https://` prefix required, no trailing slash
3. **asyncpg uses `ssl=require`** -- not `sslmode=require`
4. **Seed via direct endpoint** -- not the `-pooler` endpoint (DDL can hang on pooler)
5. **Never commit `.env`** -- set secrets in platform dashboards only
