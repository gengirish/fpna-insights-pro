from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies import get_db, get_current_user
from app.models.schemas import RAGQueryRequest, RAGQueryResponse
from app.services.perplexity import PerplexityService
from app.services.data_context import build_data_context

router = APIRouter(prefix="/rag", tags=["RAG"])


@router.post("/query", response_model=RAGQueryResponse)
async def rag_query(
    request: RAGQueryRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    # Build context from actual database tables
    postgres_data = await build_data_context(db, request.query, request.tables)

    # Send to LLM with financial context
    llm_response = await PerplexityService().generate(
        query=request.query,
        context=postgres_data,
    )

    # Audit log
    await db.execute(
        text("""
            INSERT INTO query_audit_log (user_id, query_text, tables_accessed, response_summary)
            VALUES (:uid, :query, :tables, :summary)
        """),
        {
            "uid": int(user.get("sub", 0)),
            "query": request.query,
            "tables": request.tables,
            "summary": llm_response[:500],
        },
    )

    return RAGQueryResponse(
        postgres_data=postgres_data,
        llm_response=llm_response,
        sources=["PostgreSQL Database", "Perplexity Sonar"],
    )
