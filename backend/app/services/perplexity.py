import httpx
import structlog
from app.config import get_settings

logger = structlog.get_logger()

SYSTEM_PROMPT = """You are an expert FP&A (Financial Planning & Analysis) AI assistant.
You analyze financial data from PostgreSQL tables including:
- budget_forecast: Budget vs Actual vs Forecast by department and quarter
- general_ledger: Transaction-level accounting entries (debits/credits)
- accounts_payable: Vendor invoices and payment tracking
- accounts_receivable: Customer invoices and collection tracking
- expense_claims: Employee expense reports by category

When responding:
1. Provide clear, concise analysis with specific numbers from the data
2. Highlight favorable variances (under budget) in positive terms and unfavorable variances (over budget) as areas of concern
3. Calculate key metrics: variance %, YoY change, trends
4. Offer actionable recommendations when relevant
5. Format currency values with $ and commas
6. Use bullet points for clarity"""

PROVIDERS = {
    "openrouter": {
        "url": "https://openrouter.ai/api/v1/chat/completions",
        "extra_headers": {"HTTP-Referer": "https://fpna-insights-pro.vercel.app"},
    },
    "perplexity": {
        "url": "https://api.perplexity.ai/chat/completions",
        "extra_headers": {},
    },
}


class LLMService:
    """Unified LLM service: tries OpenRouter first, then Perplexity, then mock."""

    async def generate(self, query: str, context: dict) -> tuple[str, str]:
        """Returns (response_text, provider_name)."""
        settings = get_settings()

        if settings.openrouter_api_key:
            result = await self._call_llm(
                provider="openrouter",
                api_key=settings.openrouter_api_key,
                model=settings.openrouter_model,
                query=query,
                context=context,
            )
            if result:
                return result, "OpenRouter"

        if settings.perplexity_api_key:
            result = await self._call_llm(
                provider="perplexity",
                api_key=settings.perplexity_api_key,
                model="sonar",
                query=query,
                context=context,
            )
            if result:
                return result, "Perplexity Sonar"

        return self._mock_response(query, context), "Data Summary (no LLM key)"

    async def _call_llm(
        self, provider: str, api_key: str, model: str, query: str, context: dict
    ) -> str | None:
        config = PROVIDERS[provider]
        headers = {"Authorization": f"Bearer {api_key}", **config["extra_headers"]}

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    config["url"],
                    json={
                        "model": model,
                        "messages": [
                            {"role": "system", "content": SYSTEM_PROMPT},
                            {
                                "role": "user",
                                "content": f"Query: {query}\n\nDatabase Context:\n{context}",
                            },
                        ],
                    },
                    headers=headers,
                )
                resp.raise_for_status()
                return resp.json()["choices"][0]["message"]["content"]
        except httpx.HTTPStatusError as e:
            logger.error(
                "llm_api_error", provider=provider, status=e.response.status_code
            )
            return None
        except Exception as e:
            logger.error("llm_error", provider=provider, error=str(e))
            return None

    def _mock_response(self, query: str, context: dict) -> str:
        return (
            f"**Analysis for:** {query}\n\n"
            f"*No LLM API key configured. Showing raw data context.*\n\n"
            f"{self._summarize(context)}"
        )

    def _summarize(self, context: dict) -> str:
        parts = []
        for key, value in context.items():
            if isinstance(value, list):
                parts.append(f"**{key}**: {len(value)} records")
                if value and len(value) <= 10:
                    for item in value[:5]:
                        parts.append(f"  - {item}")
            else:
                parts.append(f"**{key}**: {value}")
        return "\n".join(parts) if parts else "No data available."


# Backward-compatible alias
PerplexityService = LLMService
