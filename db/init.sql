-- FPnA Insights PRO - Database Schema
-- Designed to match real Excel datasets in /data/

CREATE TABLE IF NOT EXISTS general_ledger (
    id SERIAL PRIMARY KEY,
    gl_id VARCHAR(20) NOT NULL,
    txn_date DATE NOT NULL,
    account_number INTEGER NOT NULL,
    account_name VARCHAR(100) NOT NULL,
    debit NUMERIC(15, 2) NOT NULL DEFAULT 0,
    credit NUMERIC(15, 2) NOT NULL DEFAULT 0,
    dept VARCHAR(50) NOT NULL,
    cost_center VARCHAR(20) NOT NULL,
    description TEXT,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounts_payable (
    id SERIAL PRIMARY KEY,
    ap_id VARCHAR(20) NOT NULL,
    vendor VARCHAR(100) NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status VARCHAR(20) NOT NULL,
    paid_date DATE,
    terms VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounts_receivable (
    id SERIAL PRIMARY KEY,
    ar_id VARCHAR(20) NOT NULL,
    customer VARCHAR(100) NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status VARCHAR(20) NOT NULL,
    received_date DATE,
    terms VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budget_forecast (
    id SERIAL PRIMARY KEY,
    fiscal_year INTEGER NOT NULL,
    dept VARCHAR(50) NOT NULL,
    quarter INTEGER NOT NULL CHECK (quarter BETWEEN 1 AND 4),
    budget_usd NUMERIC(15, 2) NOT NULL,
    forecast_usd NUMERIC(15, 2) NOT NULL,
    actual_usd NUMERIC(15, 2) NOT NULL,
    variance_usd NUMERIC(15, 2) GENERATED ALWAYS AS (actual_usd - budget_usd) STORED,
    variance_pct NUMERIC(8, 4) GENERATED ALWAYS AS (
        CASE WHEN budget_usd != 0 THEN ((actual_usd - budget_usd) / budget_usd) * 100 ELSE 0 END
    ) STORED,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expense_claims (
    id SERIAL PRIMARY KEY,
    claim_id VARCHAR(20) NOT NULL,
    employee_id VARCHAR(20) NOT NULL,
    submit_date DATE NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT,
    amount NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status VARCHAR(20) NOT NULL,
    approved_by VARCHAR(50),
    pay_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'viewer',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_api_keys (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    encrypted_key TEXT NOT NULL,
    model_preference VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, provider)
);

CREATE TABLE IF NOT EXISTS query_audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    query_text TEXT NOT NULL,
    tables_accessed TEXT[],
    response_summary TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gl_txn_date ON general_ledger(txn_date);
CREATE INDEX IF NOT EXISTS idx_gl_dept ON general_ledger(dept);
CREATE INDEX IF NOT EXISTS idx_gl_account ON general_ledger(account_name);
CREATE INDEX IF NOT EXISTS idx_ap_vendor ON accounts_payable(vendor);
CREATE INDEX IF NOT EXISTS idx_ap_status ON accounts_payable(status);
CREATE INDEX IF NOT EXISTS idx_ap_due_date ON accounts_payable(due_date);
CREATE INDEX IF NOT EXISTS idx_ar_customer ON accounts_receivable(customer);
CREATE INDEX IF NOT EXISTS idx_ar_status ON accounts_receivable(status);
CREATE INDEX IF NOT EXISTS idx_ar_due_date ON accounts_receivable(due_date);
CREATE INDEX IF NOT EXISTS idx_bf_year_dept ON budget_forecast(fiscal_year, dept);
CREATE INDEX IF NOT EXISTS idx_ec_status ON expense_claims(status);
CREATE INDEX IF NOT EXISTS idx_ec_category ON expense_claims(category);
CREATE INDEX IF NOT EXISTS idx_ec_employee ON expense_claims(employee_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON query_audit_log(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user ON user_api_keys(user_id);
