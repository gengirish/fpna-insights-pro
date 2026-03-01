"""
Seed script that works with any PostgreSQL instance (Docker, Neon, Supabase).
Uses INSERT statements via psycopg2, not COPY FROM file path.

Usage:
    python db/seed_database.py                                    # uses DATABASE_URL from .env
    python db/seed_database.py --url "postgresql://user:pass@host:port/db"  # explicit URL
    python db/seed_database.py --neon                             # uses NEON_DATABASE_URL from .env
"""

import csv
import os
import sys
import argparse
from pathlib import Path
from contextlib import suppress

try:
    import psycopg2
    from psycopg2.extras import execute_values
except ImportError:
    print("Installing psycopg2-binary...")
    os.system(f"{sys.executable} -m pip install psycopg2-binary")
    import psycopg2
    from psycopg2.extras import execute_values


SEED_DIR = Path(__file__).parent / "seed"
SCHEMA_FILE = Path(__file__).parent / "init.sql"

TABLE_CSV_MAP = {
    "general_ledger": {
        "file": "general_ledger.csv",
        "columns": [
            "gl_id", "txn_date", "account_number", "account_name",
            "debit", "credit", "dept", "cost_center", "description", "currency",
        ],
    },
    "accounts_payable": {
        "file": "accounts_payable.csv",
        "columns": [
            "ap_id", "vendor", "invoice_date", "due_date",
            "amount", "currency", "status", "paid_date", "terms",
        ],
    },
    "accounts_receivable": {
        "file": "accounts_receivable.csv",
        "columns": [
            "ar_id", "customer", "invoice_date", "due_date",
            "amount", "currency", "status", "received_date", "terms",
        ],
    },
    "budget_forecast": {
        "file": "budget_forecast.csv",
        "columns": [
            "fiscal_year", "dept", "quarter",
            "budget_usd", "forecast_usd", "actual_usd", "notes",
        ],
    },
    "expense_claims": {
        "file": "expense_claims.csv",
        "columns": [
            "claim_id", "employee_id", "submit_date", "category",
            "description", "amount", "currency", "status", "approved_by", "pay_date",
        ],
    },
}

DEFAULT_ADMIN = {
    "email": "admin@fpna.local",
    "hashed_password": "$2b$12$VK3CbvgUGWUl7s8Dqu5aM.fvK.JeWuJTXsWh6jpANsnmPGWeifdyu",
    "full_name": "Admin User",
    "role": "admin",
}


def get_database_url(args) -> str:
    if args.url:
        return args.url
    if args.neon:
        url = os.environ.get("NEON_DATABASE_URL")
        if not url:
            print("ERROR: --neon flag used but NEON_DATABASE_URL not set in environment or .env")
            sys.exit(1)
        return url

    # Try .env file
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line.startswith("DATABASE_URL=") and "asyncpg" not in line:
                return line.split("=", 1)[1].strip().strip('"')
            if line.startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip().strip('"').replace("+asyncpg", "")

    return os.environ.get(
        "DATABASE_URL",
        "postgresql://postgres:changeme@localhost:5433/fpna_insights",
    ).replace("+asyncpg", "")


def run_schema(conn):
    print("  Creating schema...")
    with conn.cursor() as cur:
        cur.execute(SCHEMA_FILE.read_text())
    conn.commit()
    print("  Schema created.")


def seed_table(conn, table: str, config: dict):
    csv_path = SEED_DIR / config["file"]
    if not csv_path.exists():
        print(f"  SKIP {table}: {csv_path} not found")
        return

    columns = config["columns"]
    placeholders = ", ".join(["%s"] * len(columns))
    col_names = ", ".join(columns)
    insert_sql = f"INSERT INTO {table} ({col_names}) VALUES ({placeholders})"

    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        csv_columns = reader.fieldnames
        col_mapping = dict(zip(csv_columns, columns))

        rows = []
        for row in reader:
            values = []
            for csv_col, db_col in col_mapping.items():
                val = row[csv_col]
                if val == "" or val == "NaT":
                    val = None
                values.append(val)
            rows.append(tuple(values))

    with conn.cursor() as cur:
        cur.execute(f"DELETE FROM {table}")
        insert_vals_sql = f"INSERT INTO {table} ({col_names}) VALUES %s"
        execute_values(cur, insert_vals_sql, rows, page_size=500)
    conn.commit()
    print(f"  {table}: {len(rows)} rows inserted")


def seed_admin(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM users WHERE email = %s", (DEFAULT_ADMIN["email"],))
        if cur.fetchone()[0] == 0:
            cur.execute(
                "INSERT INTO users (email, hashed_password, full_name, role) VALUES (%s, %s, %s, %s)",
                (
                    DEFAULT_ADMIN["email"],
                    DEFAULT_ADMIN["hashed_password"],
                    DEFAULT_ADMIN["full_name"],
                    DEFAULT_ADMIN["role"],
                ),
            )
            conn.commit()
            print("  Admin user created (admin@fpna.local / admin123)")
        else:
            print("  Admin user already exists")


def main():
    parser = argparse.ArgumentParser(description="Seed FPnA database")
    parser.add_argument("--url", help="PostgreSQL connection URL")
    parser.add_argument("--neon", action="store_true", help="Use NEON_DATABASE_URL from .env")
    parser.add_argument("--schema-only", action="store_true", help="Only create schema, skip data")
    parser.add_argument("--data-only", action="store_true", help="Only insert data, skip schema")
    args = parser.parse_args()

    db_url = get_database_url(args)
    masked = db_url.split("@")[-1] if "@" in db_url else db_url
    print(f"\nConnecting to: ...@{masked}")

    try:
        conn = psycopg2.connect(db_url)
        conn.autocommit = False
        print("Connected successfully.\n")
    except Exception as e:
        print(f"ERROR connecting: {e}")
        sys.exit(1)

    try:
        if not args.data_only:
            run_schema(conn)

        if not args.schema_only:
            print("\nSeeding data...")
            for table, config in TABLE_CSV_MAP.items():
                seed_table(conn, table, config)
            seed_admin(conn)

        # Verify counts
        print("\n--- Verification ---")
        with conn.cursor() as cur:
            for table in list(TABLE_CSV_MAP.keys()) + ["users"]:
                cur.execute(f"SELECT COUNT(*) FROM {table}")
                count = cur.fetchone()[0]
                print(f"  {table}: {count} rows")

        print("\nDone! Database is ready.")

    except Exception as e:
        conn.rollback()
        print(f"\nERROR: {e}")
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
