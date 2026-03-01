from pydantic import BaseModel, Field, field_validator
from typing import Any
import re

ALLOWED_TABLES = {
    "general_ledger", "accounts_payable", "accounts_receivable",
    "budget_forecast", "expense_claims",
}


class RAGQueryRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=500)
    context: str = "Financial Dashboard"
    tables: list[str] = Field(
        default=["budget_forecast", "general_ledger", "expense_claims"],
        max_length=10,
    )

    @field_validator("query")
    @classmethod
    def sanitize_query(cls, v: str) -> str:
        dangerous = [r";\s*DROP\s+", r";\s*DELETE\s+", r";\s*UPDATE\s+", r"--", r"/\*"]
        for pattern in dangerous:
            if re.search(pattern, v, re.IGNORECASE):
                raise ValueError("Query contains disallowed patterns")
        return v.strip()

    @field_validator("tables")
    @classmethod
    def validate_tables(cls, v: list[str]) -> list[str]:
        invalid = set(v) - ALLOWED_TABLES
        if invalid:
            raise ValueError(f"Invalid tables: {invalid}")
        return v


class RAGQueryResponse(BaseModel):
    postgres_data: dict[str, Any]
    llm_response: str
    sources: list[str]


class KPIItem(BaseModel):
    label: str
    value: float
    formatted_value: str
    change_pct: float
    period: str


class BudgetVsActualItem(BaseModel):
    dept: str
    quarter: int
    fiscal_year: int
    budget_usd: float
    actual_usd: float
    forecast_usd: float
    variance_usd: float
    variance_pct: float


class DeptBreakdownItem(BaseModel):
    dept: str
    total: float


class TimeSeriesItem(BaseModel):
    period: str
    value: float
    label: str | None = None


class DashboardSummary(BaseModel):
    kpis: list[KPIItem]
    budget_vs_actual: list[BudgetVsActualItem]
    dept_breakdown: list[DeptBreakdownItem]


class APAgingItem(BaseModel):
    bucket: str
    total_amount: float
    count: int


class ARAgingItem(BaseModel):
    bucket: str
    total_amount: float
    count: int


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict
