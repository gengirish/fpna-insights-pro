# FPnA Insights PRO — Platform Overview

> **March 2026**

---

## What Is FPnA Insights PRO?

FPnA Insights PRO is a **financial dashboard with a built-in AI assistant**. It gives finance teams a single place to view key financial metrics, explore their data visually, and ask questions in plain English.

Instead of digging through spreadsheets or waiting for reports, users simply open the dashboard — or type a question like *"Which departments went over budget last quarter?"* — and get an instant, data-backed answer.

---

## What Can It Do?

### Financial Dashboard

A live overview of your organization's financial health, all in one screen:

| View | What You See |
|------|-------------|
| **Overview** | Revenue, expenses, net income, and budget variance at a glance |
| **Budget vs. Actual** | Side-by-side comparison of planned vs. real spending by department |
| **Accounts Payable** | Outstanding vendor invoices and aging breakdown |
| **Accounts Receivable** | Customer invoices and collection status |
| **Expenses** | Employee expense claims by category and status |
| **General Ledger** | Journal entries across departments and cost centers |

### AI Financial Assistant

Ask questions about your data in natural language. The AI reads your actual financial records and responds with grounded, contextual answers — not generic advice.

**Example questions:**
- *"What is our total revenue for Q3?"*
- *"Which vendors have the most overdue invoices?"*
- *"How do marketing expenses compare to budget this year?"*
- *"Summarize our accounts receivable aging."*

### Bring Your Own AI Key (BYOK)

Users can connect their own AI provider key in Settings. This means:
- Full control over AI costs
- No vendor lock-in — switch providers anytime
- The platform works with or without a key (graceful fallback)

---

## How It Works (Simplified)

```
  ┌──────────────┐        ┌──────────────┐        ┌──────────────┐
  │              │        │              │        │              │
  │  Dashboard   │◄──────▶│   Backend    │◄──────▶│   Database   │
  │  (Browser)   │        │   Server     │        │  (Financial  │
  │              │        │              │        │    Data)     │
  └──────────────┘        └──────┬───────┘        └──────────────┘
                                 │
                                 ▼
                          ┌──────────────┐
                          │              │
                          │  AI Engine   │
                          │  (answers    │
                          │   questions) │
                          │              │
                          └──────────────┘
```

1. **You open the dashboard** in your browser (desktop, tablet, or phone)
2. **The dashboard pulls live data** from your financial database
3. **Charts and KPIs update automatically** to reflect current numbers
4. **When you ask a question**, the system retrieves the relevant data, sends it to the AI, and returns a clear answer grounded in your actual records

---

## Financial Data Covered

The platform manages five core financial datasets:

| Dataset | What It Contains | Records |
|---------|-----------------|---------|
| **General Ledger** | All journal entries — debits, credits, departments | 2,000 |
| **Accounts Payable** | Vendor invoices, amounts, due dates, payment status | 800 |
| **Accounts Receivable** | Customer invoices, amounts, collection status | 900 |
| **Budget & Forecast** | Budget vs. actual vs. forecast, by department and quarter | 48 |
| **Expense Claims** | Employee expenses — amounts, categories, approval status | 1,000 |

---

## Security & Compliance

| Protection | What It Means |
|-----------|--------------|
| **Secure Login** | Email and password authentication; sessions expire automatically |
| **Encrypted Storage** | Sensitive data (like AI keys) is encrypted before being stored |
| **Access Control** | Only logged-in users can view financial data |
| **Audit Trail** | Every AI question is logged — who asked, when, and what data was used |
| **Rate Limiting** | Built-in throttling prevents abuse and controls AI costs |
| **No Plaintext Secrets** | Passwords are never stored as-is; API keys are masked in the UI |

---

## Where It Runs

The platform is hosted on modern cloud infrastructure, designed for reliability and low cost:

```
  ┌──────────────────────────────────────────────┐
  │                  Users                        │
  │          (Any browser or device)              │
  └──────────────────┬───────────────────────────┘
                     │
  ┌──────────────────▼───────────────────────────┐
  │          Dashboard (Vercel)                   │
  │   Global CDN — fast load times worldwide      │
  │   Automatic SSL encryption                    │
  └──────────────────┬───────────────────────────┘
                     │
  ┌──────────────────▼───────────────────────────┐
  │          Backend Server (Fly.io)              │
  │   Auto-scales based on demand                 │
  │   Scales to zero when idle — saves cost       │
  └──────────────────┬───────────────────────────┘
                     │
  ┌──────────────────▼───────────────────────────┐
  │          Database (Neon)                       │
  │   Serverless — scales up and down on demand   │
  │   Automatic backups and recovery              │
  └──────────────────────────────────────────────┘
```

**Key benefits of this setup:**
- Loads fast globally (edge CDN)
- Scales automatically under heavy use
- Near-zero cost when idle (serverless)
- Automatic SSL — all data encrypted in transit
- No servers to manage or maintain

---

## Device Support

The dashboard is fully responsive and works on:
- Desktop browsers (Chrome, Firefox, Safari, Edge)
- Tablets (iPad, Android)
- Mobile phones (navigation adapts to smaller screens)

---

## What Makes It Different

| Feature | Benefit |
|---------|---------|
| **AI built in** | Ask financial questions in plain English — no reports to build |
| **Your data, your answers** | AI responses are grounded in your actual records, not generic |
| **Bring Your Own Key** | Use your own AI provider — full cost transparency, no lock-in |
| **Works on any device** | Responsive design for desktop, tablet, and mobile |
| **Secure by default** | Encryption, audit trails, and access control out of the box |
| **Low operational cost** | Serverless infrastructure scales to zero when not in use |
| **Ready to grow** | Built to support more users, more data, and more features |

---

*FPnA Insights PRO — Financial intelligence at your fingertips.*
