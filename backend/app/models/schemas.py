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
    email: str = Field(..., min_length=5, max_length=254)
    password: str = Field(..., min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Invalid email format")
        return v.strip().lower()


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict


# --- BYOK (Bring Your Own Key) settings ---

ALLOWED_PROVIDERS = {"openrouter", "perplexity"}


class ApiKeyEntry(BaseModel):
    provider: str
    masked_key: str
    model_preference: str | None = None
    has_key: bool = True


class ApiKeysResponse(BaseModel):
    keys: list[ApiKeyEntry]
    server_has_openrouter: bool = False
    server_has_perplexity: bool = False


class ApiKeyUpdate(BaseModel):
    provider: str = Field(..., min_length=1, max_length=50)
    api_key: str = Field(..., min_length=1, max_length=500)
    model_preference: str | None = Field(default=None, max_length=100)

    @field_validator("provider")
    @classmethod
    def validate_provider(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in ALLOWED_PROVIDERS:
            raise ValueError(f"Provider must be one of: {ALLOWED_PROVIDERS}")
        return v

    @field_validator("api_key")
    @classmethod
    def validate_api_key(cls, v: str) -> str:
        v = v.strip()
        if not v.startswith(("sk-", "pplx-")):
            raise ValueError("API key must start with sk- or pplx-")
        return v


class ApiKeyDelete(BaseModel):
    provider: str = Field(..., min_length=1, max_length=50)

    @field_validator("provider")
    @classmethod
    def validate_provider(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in ALLOWED_PROVIDERS:
            raise ValueError(f"Provider must be one of: {ALLOWED_PROVIDERS}")
        return v
