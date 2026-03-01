# FPnA Insights PRO

Production-grade Financial Planning & Analysis dashboard with AI-powered insights.

**Stack**: FastAPI + Next.js 16 + PostgreSQL + Perplexity Sonar (RAG)

## Quick Start

### Prerequisites
- Docker Desktop
- Python 3.12+
- Node.js 20+

### 1. Start Database

```bash
docker compose up postgres -d
```

### 2. Seed Data

```bash
cp .env.example .env
python db/seed_database.py
```

### 3. Start Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### 4. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

### 5. Open

- Frontend: http://localhost:3000
- API Docs: http://localhost:8001/api/docs
- Login: `admin@fpna.local` / `admin123`

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/health` | Health check |
| GET | `/api/v1/health/db` | Database health |
| POST | `/api/v1/auth/login` | JWT login |
| GET | `/api/v1/dashboard/summary` | KPIs + budget vs actual |
| GET | `/api/v1/dashboard/ap-aging` | Accounts payable aging |
| GET | `/api/v1/dashboard/ar-aging` | Accounts receivable aging |
| GET | `/api/v1/dashboard/expense-summary` | Expense claims summary |
| GET | `/api/v1/dashboard/gl-summary` | General ledger summary |
| POST | `/api/v1/rag/query` | AI-powered financial query |

## Data

Seeded from 5 Excel datasets (4,748 records total):

| Table | Records | Source |
|-------|---------|--------|
| general_ledger | 2,000 | General-Ledger.xlsx |
| accounts_payable | 800 | Accounts-Payable.xlsx |
| accounts_receivable | 900 | Accounts-Receivable.xlsx |
| budget_forecast | 48 | Budget-Forecast.xlsx |
| expense_claims | 1,000 | Expense-Claims.xlsx |

## Neon PostgreSQL

See [docs/NEON_SETUP.md](docs/NEON_SETUP.md) for Neon serverless Postgres configuration.

```bash
python db/seed_database.py --neon
```
