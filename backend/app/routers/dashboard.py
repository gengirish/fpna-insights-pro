from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies import get_db, get_current_user
from app.models.schemas import (
    DashboardSummary, KPIItem, BudgetVsActualItem,
    DeptBreakdownItem, APAgingItem, ARAgingItem,
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummary)
async def dashboard_summary(
    fiscal_year: int = Query(default=2025),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    # KPIs from budget_forecast: total budget, actual, variance across all depts
    kpi_result = await db.execute(
        text("""
            SELECT
                SUM(budget_usd) as total_budget,
                SUM(actual_usd) as total_actual,
                SUM(forecast_usd) as total_forecast,
                SUM(actual_usd) - SUM(budget_usd) as total_variance
            FROM budget_forecast
            WHERE fiscal_year = :year
        """),
        {"year": fiscal_year},
    )
    kpi_row = kpi_result.mappings().first()

    # Previous year for change calculation
    prev_result = await db.execute(
        text("SELECT SUM(actual_usd) as prev_actual FROM budget_forecast WHERE fiscal_year = :year"),
        {"year": fiscal_year - 1},
    )
    prev_row = prev_result.mappings().first()
    prev_actual = float(prev_row["prev_actual"] or 0)

    total_actual = float(kpi_row["total_actual"] or 0)
    total_budget = float(kpi_row["total_budget"] or 0)
    total_forecast = float(kpi_row["total_forecast"] or 0)
    total_variance = float(kpi_row["total_variance"] or 0)

    yoy_change = ((total_actual - prev_actual) / prev_actual * 100) if prev_actual else 0
    budget_var_pct = ((total_actual - total_budget) / total_budget * 100) if total_budget else 0

    kpis = [
        KPIItem(label="Total Actual Spend", value=total_actual, formatted_value=f"${total_actual:,.0f}", change_pct=round(yoy_change, 1), period=str(fiscal_year)),
        KPIItem(label="Total Budget", value=total_budget, formatted_value=f"${total_budget:,.0f}", change_pct=0, period=str(fiscal_year)),
        KPIItem(label="Budget Variance", value=total_variance, formatted_value=f"${total_variance:,.0f}", change_pct=round(budget_var_pct, 1), period=str(fiscal_year)),
        KPIItem(label="Forecast Accuracy", value=total_forecast, formatted_value=f"${total_forecast:,.0f}", change_pct=round(((total_actual - total_forecast) / total_forecast * 100) if total_forecast else 0, 1), period=str(fiscal_year)),
    ]

    # Budget vs Actual by dept and quarter
    bva_result = await db.execute(
        text("""
            SELECT dept, quarter, fiscal_year, budget_usd, actual_usd, forecast_usd,
                   actual_usd - budget_usd as variance_usd,
                   CASE WHEN budget_usd != 0 THEN ((actual_usd - budget_usd) / budget_usd) * 100 ELSE 0 END as variance_pct
            FROM budget_forecast
            WHERE fiscal_year = :year
            ORDER BY dept, quarter
        """),
        {"year": fiscal_year},
    )
    budget_vs_actual = [BudgetVsActualItem(**row) for row in bva_result.mappings().all()]

    # Dept breakdown: total actual by dept
    dept_result = await db.execute(
        text("""
            SELECT dept, SUM(actual_usd) as total
            FROM budget_forecast
            WHERE fiscal_year = :year
            GROUP BY dept
            ORDER BY total DESC
        """),
        {"year": fiscal_year},
    )
    dept_breakdown = [DeptBreakdownItem(**row) for row in dept_result.mappings().all()]

    return DashboardSummary(kpis=kpis, budget_vs_actual=budget_vs_actual, dept_breakdown=dept_breakdown)


@router.get("/ap-aging", response_model=list[APAgingItem])
async def ap_aging(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    result = await db.execute(text("""
        SELECT bucket, SUM(total_amount) as total_amount, SUM(count) as count FROM (
            SELECT
                CASE
                    WHEN status = 'Paid' THEN 'Paid'
                    WHEN due_date >= CURRENT_DATE THEN 'Current'
                    WHEN CURRENT_DATE - due_date <= 30 THEN '1-30 days'
                    WHEN CURRENT_DATE - due_date <= 60 THEN '31-60 days'
                    WHEN CURRENT_DATE - due_date <= 90 THEN '61-90 days'
                    ELSE '90+ days'
                END as bucket,
                amount as total_amount,
                1 as count
            FROM accounts_payable
        ) sub
        GROUP BY bucket
        ORDER BY
            CASE bucket
                WHEN 'Current' THEN 1 WHEN '1-30 days' THEN 2 WHEN '31-60 days' THEN 3
                WHEN '61-90 days' THEN 4 WHEN '90+ days' THEN 5 WHEN 'Paid' THEN 6
            END
    """))
    return [APAgingItem(**row) for row in result.mappings().all()]


@router.get("/ar-aging", response_model=list[ARAgingItem])
async def ar_aging(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    result = await db.execute(text("""
        SELECT bucket, SUM(total_amount) as total_amount, SUM(count) as count FROM (
            SELECT
                CASE
                    WHEN status = 'Paid' THEN 'Collected'
                    WHEN due_date >= CURRENT_DATE THEN 'Current'
                    WHEN CURRENT_DATE - due_date <= 30 THEN '1-30 days'
                    WHEN CURRENT_DATE - due_date <= 60 THEN '31-60 days'
                    WHEN CURRENT_DATE - due_date <= 90 THEN '61-90 days'
                    ELSE '90+ days'
                END as bucket,
                amount as total_amount,
                1 as count
            FROM accounts_receivable
        ) sub
        GROUP BY bucket
        ORDER BY
            CASE bucket
                WHEN 'Current' THEN 1 WHEN '1-30 days' THEN 2 WHEN '31-60 days' THEN 3
                WHEN '61-90 days' THEN 4 WHEN '90+ days' THEN 5 WHEN 'Collected' THEN 6
            END
    """))
    return [ARAgingItem(**row) for row in result.mappings().all()]


@router.get("/expense-summary")
async def expense_summary(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    by_category = await db.execute(text("""
        SELECT category, SUM(amount) as total, COUNT(*) as claim_count
        FROM expense_claims
        GROUP BY category ORDER BY total DESC
    """))

    by_status = await db.execute(text("""
        SELECT status, SUM(amount) as total, COUNT(*) as claim_count
        FROM expense_claims
        GROUP BY status ORDER BY total DESC
    """))

    return {
        "by_category": [dict(r) for r in by_category.mappings().all()],
        "by_status": [dict(r) for r in by_status.mappings().all()],
    }


@router.get("/gl-summary")
async def gl_summary(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    by_account = await db.execute(text("""
        SELECT account_name, SUM(debit) as total_debit, SUM(credit) as total_credit,
               SUM(credit) - SUM(debit) as net
        FROM general_ledger
        GROUP BY account_name ORDER BY net DESC
    """))

    by_dept = await db.execute(text("""
        SELECT dept, SUM(debit) as total_debit, SUM(credit) as total_credit
        FROM general_ledger
        GROUP BY dept ORDER BY total_debit DESC
    """))

    monthly_trend = await db.execute(text("""
        SELECT TO_CHAR(txn_date, 'YYYY-MM') as month,
               SUM(debit) as total_debit, SUM(credit) as total_credit
        FROM general_ledger
        GROUP BY month ORDER BY month
    """))

    return {
        "by_account": [dict(r) for r in by_account.mappings().all()],
        "by_dept": [dict(r) for r in by_dept.mappings().all()],
        "monthly_trend": [dict(r) for r in monthly_trend.mappings().all()],
    }
