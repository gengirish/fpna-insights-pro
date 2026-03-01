from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies import get_db

router = APIRouter(prefix="/health", tags=["Health"])


@router.get("")
async def health():
    return {"status": "healthy", "service": "fpna-insights-api"}


@router.get("/db")
async def health_db(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("SELECT 1"))
    result.scalar()
    return {"status": "healthy", "database": "connected"}
