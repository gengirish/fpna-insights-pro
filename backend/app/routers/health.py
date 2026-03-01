from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
import structlog
from app.dependencies import get_db

logger = structlog.get_logger()
router = APIRouter(prefix="/health", tags=["Health"])


@router.get("")
async def health():
    return {"status": "healthy", "service": "fpna-insights-api"}


@router.get("/db")
async def health_db(db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(text("SELECT 1"))
        result.scalar()
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        logger.error("health_db_check_failed", error=str(e))
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "database": "disconnected"},
        )
