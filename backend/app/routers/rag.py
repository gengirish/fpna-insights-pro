from fastapi import APIRouter, Depends, Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
import structlog
from app.dependencies import get_db, get_current_user
from app.models.schemas import RAGQueryRequest, RAGQueryResponse
from app.services.perplexity import LLMService
from app.services.data_context import build_data_context
from app.middleware.rate_limit import limiter

logger = structlog.get_logger()
router = APIRouter(prefix="/rag", tags=["RAG"])


@router.post("/query", response_model=RAGQueryResponse)
@limiter.limit("10/minute")
async def rag_query(
    request: Request,
    body: RAGQueryRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    postgres_data = await build_data_context(db, body.query, body.tables)

    llm_response, provider = await LLMService().generate(
        query=body.query,
        context=postgres_data,
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
