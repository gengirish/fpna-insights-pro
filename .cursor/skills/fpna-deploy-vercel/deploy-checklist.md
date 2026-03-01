# Quick Deploy Reference

## Neon Connection String Conversion

Given a Neon connection string:
```
postgresql://neondb_owner:PASSWORD@ep-xxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

### For seed script (psycopg2) -- use direct endpoint, keep channel_binding:
```
postgresql://neondb_owner:PASSWORD@ep-xxx.REGION.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```
(Remove `-pooler` from hostname)

### For backend (asyncpg) -- use pooler, change ssl param, drop channel_binding:
```
postgresql+asyncpg://neondb_owner:PASSWORD@ep-xxx-pooler.REGION.aws.neon.tech/neondb?ssl=require
```
(Add `+asyncpg` prefix, change `sslmode=require` to `ssl=require`, remove `channel_binding`)

## Deploy Commands

```bash
# 1. Seed Neon
python db/seed_database.py --url "postgresql://USER:PASS@ep-xxx.REGION.neon.tech/neondb?sslmode=require"

# 2. Deploy frontend to Vercel
cd frontend
npx vercel --prod

# 3. Backend deploys automatically from render.yaml on git push
git push origin main
```

## Required Environment Variables

### Render (backend)
| Variable | Value |
|----------|-------|
| DATABASE_URL | `postgresql+asyncpg://...@ep-xxx-pooler.neon.tech/neondb?ssl=require` |
| JWT_SECRET | `openssl rand -hex 32` |
| PERPLEXITY_API_KEY | Your Perplexity key (optional) |
| CORS_ORIGINS | `["https://YOUR-APP.vercel.app"]` |
| DEBUG | `false` |

### Vercel (frontend)
| Variable | Value |
|----------|-------|
| NEXT_PUBLIC_API_URL | `https://fpna-insights-api.onrender.com` |
