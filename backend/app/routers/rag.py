from fastapi import APIRouter, Depends, Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
import structlog
from app.config import get_settings
from app.dependencies import get_db, get_current_user
from app.models.schemas import RAGQueryRequest, RAGQueryResponse
from app.services.perplexity import LLMService
from app.services.data_context import build_data_context
from app.services.encryption import decrypt_api_key
from app.middleware.rate_limit import limiter

logger = structlog.get_logger()
router = APIRouter(prefix="/rag", tags=["RAG"])


async def _load_user_keys(db: AsyncSession, user_id: int) -> dict[str, dict]:
    """Load and decrypt BYOK keys for the given user."""
    settings = get_settings()
    result = await db.execute(
        text("SELECT provider, encrypted_key, model_preference FROM user_api_keys WHERE user_id = :uid"),
        {"uid": user_id},
    )
    keys: dict[str, dict] = {}
    for row in result.mappings().all():
        try:
            plain = decrypt_api_key(row["encrypted_key"], settings.jwt_secret)
            keys[row["provider"]] = {"api_key": plain, "model": row["model_preference"]}
        except Exception:
            logger.warning("byok_decrypt_failed", provider=row["provider"], user_id=user_id)
    return keys


@router.post("/query", response_model=RAGQueryResponse)
@limiter.limit("10/minute")
async def rag_query(
    request: Request,
    body: RAGQueryRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    user_id = int(user.get("sub", 0))
    user_keys = await _load_user_keys(db, user_id) if user_id > 0 else {}
    postgres_data = await build_data_context(db, body.query, body.tables)

    llm_response, provider = await LLMService().generate(
        query=body.query,
        context=postgres_data,
        user_keys=user_keys,
    )

    try:
        user_id = int(user.get("sub", 0))
        if user_id > 0:
            await db.execute(
                text("""
                    INSERT INTO query_audit_log (user_id, query_text, tables_accessed, response_summary)
                    VALUES (:uid, :query, :tables, :summary)
                """),
                {
                    "uid": user_id,
                    "query": body.query,
                    "tables": body.tables,
                    "summary": llm_response[:500],
                },
            )
    except Exception as e:
        logger.warning("audit_log_failed", error=str(e), user_sub=user.get("sub"))

    return RAGQueryResponse(
        postgres_data=postgres_data,
        llm_response=llm_response,
        sources=["PostgreSQL Database", provider],
    )
