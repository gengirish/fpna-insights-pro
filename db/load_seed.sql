-- Load CSV seed data into tables
-- CSVs are mounted at /seed/ inside the container

COPY general_ledger (gl_id, txn_date, account_number, account_name, debit, credit, dept, cost_center, description, currency)
FROM '/seed/general_ledger.csv' WITH (FORMAT csv, HEADER true, NULL '');

COPY accounts_payable (ap_id, vendor, invoice_date, due_date, amount, currency, status, paid_date, terms)
FROM '/seed/accounts_payable.csv' WITH (FORMAT csv, HEADER true, NULL '');

COPY accounts_receivable (ar_id, customer, invoice_date, due_date, amount, currency, status, received_date, terms)
FROM '/seed/accounts_receivable.csv' WITH (FORMAT csv, HEADER true, NULL '');

COPY budget_forecast (fiscal_year, dept, quarter, budget_usd, forecast_usd, actual_usd, notes)
FROM '/seed/budget_forecast.csv' WITH (FORMAT csv, HEADER true, NULL '');

COPY expense_claims (claim_id, employee_id, submit_date, category, description, amount, currency, status, approved_by, pay_date)
FROM '/seed/expense_claims.csv' WITH (FORMAT csv, HEADER true, NULL '');

-- Seed a default admin user (password: admin123 -- change in production)
-- bcrypt hash of 'admin123'
INSERT INTO users (email, hashed_password, full_name, role) VALUES
('admin@fpna.local', '$2b$12$LJ3m4ys3Lk0TSwHlXD3ttOi/bCHRHKfOzSUqBnGKYQ4GNmqjW0Cje', 'Admin User', 'admin')
ON CONFLICT (email) DO NOTHING;
