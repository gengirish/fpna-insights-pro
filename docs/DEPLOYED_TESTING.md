# FPnA Insights PRO — Deployed Server Testing Guide

## Deployed URLs

> **Before testing:** Replace `<YOUR_VERCEL_URL>` and `<YOUR_BACKEND_URL>` below with your
> actual deployment URLs. To find them:
>
> - **Vercel frontend:** Run `npx vercel ls` or check [vercel.com/dashboard](https://vercel.com/dashboard)
> - **Fly.io backend:** Run `flyctl apps list` or check [fly.io/dashboard](https://fly.io/dashboard)

| Service  | URL |
|----------|-----|
| Frontend | `<YOUR_VERCEL_URL>` (e.g. `https://fpna-insights-pro.vercel.app`) |
| Backend  | `<YOUR_BACKEND_URL>` (e.g. `https://fpna-insights-api.fly.dev`) |
| Database | Neon PostgreSQL (serverless) — [console.neon.tech](https://console.neon.tech) |

### Quick URL Setup (run once, then all commands below just work)

```bash
# bash / zsh
export API_URL="https://fpna-insights-api.fly.dev"
export FRONTEND_URL="https://your-app.vercel.app"
```

```powershell
# PowerShell
$API_URL = "https://fpna-insights-api.fly.dev"
$FRONTEND_URL = "https://your-app.vercel.app"
```

---

## 1. Health Checks (No Auth Required)

### API Health

```bash
curl $API_URL/api/v1/health
```

Expected:
```json
{"status": "healthy", "service": "fpna-insights-api"}
```

### Database Connectivity

```bash
curl $API_URL/api/v1/health/db
```

Expected:
```json
{"status": "healthy", "database": "connected"}
```

> **Note:** Fly.io auto-stops machines after inactivity. First request may take 2-5 seconds (cold start).

---

## 2. Authentication

### Login (Get JWT Token)

```bash
curl -X POST $API_URL/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@fpna.local", "password": "admin123"}'
```

Expected:
```json
{
  "access_token": "<JWT_TOKEN>",
  "expires_in": 3600,
  "user": {
    "id": 1,
    "email": "admin@fpna.local",
    "full_name": "FPnA Admin",
    "role": "admin"
  }
}
```

Save the token for subsequent requests:
```bash
# bash / zsh
export TOKEN="<paste access_token here>"

# PowerShell
$TOKEN = "<paste access_token here>"
```

### Verify Token (Get Current User)

```bash
curl $API_URL/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

---

## 3. Dashboard Endpoints (Auth Required)

All dashboard endpoints require the `Authorization: Bearer <TOKEN>` header.

### 3a. Dashboard Summary (KPIs + Budget vs Actual)

```bash
curl "$API_URL/api/v1/dashboard/summary?fiscal_year=2025" \
  -H "Authorization: Bearer $TOKEN"
```

**Verify:**
- [ ] `kpis` array has 4 items: Total Actual Spend, Total Budget, Budget Variance, Forecast Accuracy
- [ ] `budget_vs_actual` array has entries per dept/quarter
- [ ] `dept_breakdown` array shows totals by department
- [ ] Total Actual Spend is approximately $1.8M

### 3b. AP Aging (Accounts Payable)

```bash
curl $API_URL/api/v1/dashboard/ap-aging \
  -H "Authorization: Bearer $TOKEN"
```

**Verify:**
- [ ] Returns aging buckets: Current, 1-30 days, 31-60 days, 61-90 days, 90+ days, Paid
- [ ] Each bucket has `total_amount` and `count`
- [ ] Counts sum to approximately 800

### 3c. AR Aging (Accounts Receivable)

```bash
curl $API_URL/api/v1/dashboard/ar-aging \
  -H "Authorization: Bearer $TOKEN"
```

**Verify:**
- [ ] Returns aging buckets: Current, 1-30 days, 31-60 days, 61-90 days, 90+ days, Collected
- [ ] Counts sum to approximately 900

### 3d. Expense Summary

```bash
curl $API_URL/api/v1/dashboard/expense-summary \
  -H "Authorization: Bearer $TOKEN"
```

**Verify:**
- [ ] `by_category` shows expense categories (Travel, Office, etc.) with totals
- [ ] `by_status` shows statuses (Approved, Pending, Rejected, etc.) with totals
- [ ] Claim counts sum to approximately 1,000

### 3e. General Ledger Summary

```bash
curl $API_URL/api/v1/dashboard/gl-summary \
  -H "Authorization: Bearer $TOKEN"
```

**Verify:**
- [ ] `by_account` shows account names with debit/credit/net
- [ ] `by_dept` shows department breakdowns
- [ ] `monthly_trend` shows monthly debit/credit totals in YYYY-MM format

---

## 4. RAG / AI Query (Auth Required)

```bash
curl -X POST $API_URL/api/v1/rag/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is our total budget variance for 2025?",
    "tables": ["budget_forecast"]
  }'
```

**Verify:**
- [ ] `postgres_data` contains relevant financial data from the database
- [ ] `llm_response` contains an AI-generated analysis
- [ ] `sources` includes "PostgreSQL Database"
- [ ] Rate limit: 10 requests/minute per user

> **Note:** This endpoint requires a valid `OPENROUTER_API_KEY` configured on the backend.

---

## 5. Frontend UI Testing

Open your Vercel frontend URL and verify:

| # | Test | Expected |
|---|------|----------|
| 1 | Load login page | Login form renders without errors |
| 2 | Login with `admin@fpna.local` / `admin123` | Redirects to dashboard |
| 3 | KPI cards | 4 cards showing Total Actual Spend (~$1.8M), Total Budget, Budget Variance, Forecast Accuracy |
| 4 | Budget vs Actual chart | Bar/line chart renders with department data |
| 5 | Variance table | All departments and quarters visible |
| 6 | AP Aging tab | Aging buckets chart/table loads |
| 7 | AR Aging tab | Aging buckets chart/table loads |
| 8 | Expense Claims tab | Category and status breakdowns render |
| 9 | GL Summary tab | Account, department, and monthly trend data renders |
| 10 | Ask AI button | Opens chat, returns AI-powered financial analysis |
| 11 | Logout | Clears session, returns to login page |

---

## 6. Database Record Counts

To verify data integrity, these are the expected record counts after seeding:

| Table | Expected Count |
|-------|---------------|
| `general_ledger` | 2,000 |
| `accounts_payable` | 800 |
| `accounts_receivable` | 900 |
| `budget_forecast` | 48 |
| `expense_claims` | 1,000 |
| `users` | >= 1 |
| `query_audit_log` | >= 0 (grows with RAG usage) |

If you have direct database access (e.g., via Neon console):

```sql
SELECT 'general_ledger' AS tbl, COUNT(*) AS cnt FROM general_ledger
UNION ALL SELECT 'accounts_payable', COUNT(*) FROM accounts_payable
UNION ALL SELECT 'accounts_receivable', COUNT(*) FROM accounts_receivable
UNION ALL SELECT 'budget_forecast', COUNT(*) FROM budget_forecast
UNION ALL SELECT 'expense_claims', COUNT(*) FROM expense_claims
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'query_audit_log', COUNT(*) FROM query_audit_log;
```

---

## 7. PowerShell Versions (Windows)

For testing from PowerShell instead of bash:

```powershell
# Set your URLs once
$API_URL = "https://fpna-insights-api.fly.dev"   # <-- replace with your Fly.io URL

# Health check
Invoke-RestMethod -Uri "$API_URL/api/v1/health"

# Login
$body = @{ email = "admin@fpna.local"; password = "admin123" } | ConvertTo-Json
$login = Invoke-RestMethod -Uri "$API_URL/api/v1/auth/login" `
  -Method POST -ContentType "application/json" -Body $body
$TOKEN = $login.access_token

# Dashboard summary
$headers = @{ Authorization = "Bearer $TOKEN" }
Invoke-RestMethod -Uri "$API_URL/api/v1/dashboard/summary?fiscal_year=2025" `
  -Headers $headers

# AP Aging
Invoke-RestMethod -Uri "$API_URL/api/v1/dashboard/ap-aging" -Headers $headers

# AR Aging
Invoke-RestMethod -Uri "$API_URL/api/v1/dashboard/ar-aging" -Headers $headers

# Expense Summary
Invoke-RestMethod -Uri "$API_URL/api/v1/dashboard/expense-summary" -Headers $headers

# GL Summary
Invoke-RestMethod -Uri "$API_URL/api/v1/dashboard/gl-summary" -Headers $headers

# RAG Query
$ragBody = @{ query = "What is our total budget variance for 2025?"; tables = @("budget_forecast") } | ConvertTo-Json
Invoke-RestMethod -Uri "$API_URL/api/v1/rag/query" `
  -Method POST -ContentType "application/json" -Headers $headers -Body $ragBody
```

---

## 8. Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| 502 Bad Gateway | Fly.io machine stopped or OOM | Wait 5s and retry (cold start), or scale: `flyctl scale memory 512` |
| CORS error in browser | Frontend URL not in `CORS_ORIGINS` | `flyctl secrets set CORS_ORIGINS="https://your-app.vercel.app"` |
| 401 Unauthorized | Token expired or missing | Re-login to get a fresh token |
| 503 Database unhealthy | Neon connection issue | Check Neon dashboard, verify `DATABASE_URL` secret on Fly.io |
| Empty dashboard data | Database not seeded | Run `python db/seed_database.py --neon` |
| Slow first load | Fly.io cold start + Neon cold start | Normal on free tier; takes 2-5s |
| RAG returns error | Missing `OPENROUTER_API_KEY` | `flyctl secrets set OPENROUTER_API_KEY="sk-or-..."` |
