"""Builds data context from PostgreSQL for RAG queries."""

import asyncio
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

logger = structlog.get_logger()

TABLE_QUERIES = {
    "budget_forecast": """
        SELECT dept, quarter, fiscal_year, budget_usd, actual_usd, forecast_usd,
               actual_usd - budget_usd as variance_usd,
               ROUND(CASE WHEN budget_usd != 0 THEN ((actual_usd - budget_usd) / budget_usd) * 100 ELSE 0 END, 2) as variance_pct
        FROM budget_forecast
        ORDER BY fiscal_year DESC, dept, quarter
        LIMIT 100
    """,
    "general_ledger": """
        SELECT account_name, dept,
               SUM(debit) as total_debit, SUM(credit) as total_credit,
               SUM(credit) - SUM(debit) as net,
               COUNT(*) as txn_count
        FROM general_ledger
        GROUP BY account_name, dept
        ORDER BY net DESC
        LIMIT 50
    """,
    "accounts_payable": """
        SELECT vendor, status, SUM(amount) as total_amount, COUNT(*) as invoice_count,
               MIN(due_date) as earliest_due, MAX(due_date) as latest_due
        FROM accounts_payable
        GROUP BY vendor, status
        ORDER BY total_amount DESC
        LIMIT 50
    """,
    "accounts_receivable": """
        SELECT customer, status, SUM(amount) as total_amount, COUNT(*) as invoice_count,
               MIN(due_date) as earliest_due, MAX(due_date) as latest_due
        FROM accounts_receivable
        GROUP BY customer, status
        ORDER BY total_amount DESC
        LIMIT 50
    """,
    "expense_claims": """
        SELECT category, status, COUNT(*) as claim_count, SUM(amount) as total_amount,
               AVG(amount) as avg_amount
        FROM expense_claims
        GROUP BY category, status
        ORDER BY total_amount DESC
        LIMIT 50
    """,
}


async def _fetch_table(db: AsyncSession, table: str) -> tuple[str, list | dict]:
    sql = TABLE_QUERIES.get(table)
    if not sql:
        return table, []
    try:
        result = await db.execute(text(sql))
        rows = result.mappings().all()
        return table, [
            {k: (str(v) if v is not None else None) for k, v in dict(row).items()}
            for row in rows
        ]
    except SQLAlchemyError as e:
        logger.error("data_context_query_failed", table=table, error=str(e))
        return table, {"error": "Failed to fetch data"}


async def build_data_context(db: AsyncSession, query: str, tables: list[str]) -> dict:
    results = await asyncio.gather(
        *[_fetch_table(db, table) for table in tables],
        return_exceptions=True,
    )

    context = {}
    for result in results:
        if isinstance(result, Exception):
            logger.error("data_context_unexpected_error", error=str(result))
            continue
        table_name, data = result
        context[table_name] = data

    return context
