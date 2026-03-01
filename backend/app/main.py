from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import structlog
from app.config import get_settings
from app.routers import health, auth, dashboard, rag

structlog.configure(
    processors=[
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.dev.ConsoleRenderer(),
    ],
)


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="FPnA Insights API",
        version="1.0.0",
        docs_url="/api/docs" if settings.debug else None,
        redoc_url="/api/redoc" if settings.debug else None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )

    app.include_router(health.router, prefix="/api/v1")
    app.include_router(auth.router, prefix="/api/v1")
    app.include_router(dashboard.router, prefix="/api/v1")
    app.include_router(rag.router, prefix="/api/v1")

    return app


app = create_app()
