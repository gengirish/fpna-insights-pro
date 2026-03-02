import asyncio
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

Rules:
1. Be concise. Answer in 2-4 sentences max unless the user explicitly asks for detail.
2. Lead with the key number(s) and the takeaway, not a breakdown of every field.
3. Only add recommendations or YoY comparisons when the user asks for them.
4. Format currency with $ and commas. Use % for variances.
5. If the variance is unfavorable, say so in one clause — don't elaborate unless asked."""

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
    """Unified LLM service: tries user BYOK first, then server keys, then mock."""

    async def generate(
        self,
        query: str,
        context: dict,
        user_keys: dict[str, dict] | None = None,
    ) -> tuple[str, str]:
        """Returns (response_text, provider_name).

        user_keys format: {"openrouter": {"api_key": "...", "model": "..."}, ...}
        Priority: user BYOK > server env vars > mock fallback.
        """
        settings = get_settings()
        user_keys = user_keys or {}

        byok_or = user_keys.get("openrouter")
        if byok_or:
            result = await self._call_llm(
                provider="openrouter",
                api_key=byok_or["api_key"],
                model=byok_or.get("model") or settings.openrouter_model,
                query=query,
                context=context,
            )
            if result:
                return result, "OpenRouter (BYOK)"

        byok_pp = user_keys.get("perplexity")
        if byok_pp:
            result = await self._call_llm(
                provider="perplexity",
                api_key=byok_pp["api_key"],
                model=byok_pp.get("model") or "sonar",
                query=query,
                context=context,
            )
            if result:
                return result, "Perplexity Sonar (BYOK)"

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
        self, provider: str, api_key: str, model: str, query: str, context: dict,
        max_retries: int = 2,
    ) -> str | None:
        config = PROVIDERS[provider]
        headers = {"Authorization": f"Bearer {api_key}", **config["extra_headers"]}
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": f"Query: {query}\n\nDatabase Context:\n{context}",
                },
            ],
        }

        for attempt in range(max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.post(config["url"], json=payload, headers=headers)
                    resp.raise_for_status()
                    data = resp.json()
                    return data["choices"][0]["message"]["content"]
            except httpx.HTTPStatusError as e:
                status_code = e.response.status_code
                if status_code >= 500 and attempt < max_retries:
                    logger.warning("llm_retry", provider=provider, status=status_code, attempt=attempt + 1)
                    await asyncio.sleep(1 * (attempt + 1))
                    continue
                logger.error("llm_api_error", provider=provider, status=status_code)
                return None
            except (httpx.TimeoutException, httpx.ConnectError) as e:
                if attempt < max_retries:
                    logger.warning("llm_retry", provider=provider, error=type(e).__name__, attempt=attempt + 1)
                    await asyncio.sleep(1 * (attempt + 1))
                    continue
                logger.error("llm_error", provider=provider, error=str(e))
                return None
            except (KeyError, IndexError, ValueError) as e:
                logger.error("llm_parse_error", provider=provider, error=str(e))
                return None
            except Exception as e:
                logger.error("llm_error", provider=provider, error=str(e))
                return None
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
