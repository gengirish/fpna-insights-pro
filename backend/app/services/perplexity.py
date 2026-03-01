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


class PerplexityService:
    async def generate(self, query: str, context: dict) -> str:
        settings = get_settings()

        if not settings.perplexity_api_key:
            return self._mock_response(query, context)

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    "https://api.perplexity.ai/chat/completions",
                    json={
                        "model": "sonar",
                        "messages": [
                            {"role": "system", "content": SYSTEM_PROMPT},
                            {"role": "user", "content": f"Query: {query}\n\nDatabase Context:\n{context}"},
                        ],
                    },
                    headers={"Authorization": f"Bearer {settings.perplexity_api_key}"},
                )
                resp.raise_for_status()
                return resp.json()["choices"][0]["message"]["content"]
        except httpx.HTTPStatusError as e:
            logger.error("perplexity_api_error", status=e.response.status_code)
            return f"LLM API error (status {e.response.status_code}). Using data context only.\n\nData summary:\n{self._summarize(context)}"
        except Exception as e:
            logger.error("perplexity_error", error=str(e))
            return f"Could not reach LLM service. Data summary:\n{self._summarize(context)}"

    def _mock_response(self, query: str, context: dict) -> str:
        """Fallback when no API key is configured -- returns structured data summary."""
        return (
            f"**Analysis for:** {query}\n\n"
            f"*Note: Running without Perplexity API key. Showing raw data context.*\n\n"
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
