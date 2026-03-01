from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, status, Depends, Response, Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
import bcrypt
from jose import jwt
from app.config import get_settings
from app.dependencies import get_db, get_current_user
from app.models.schemas import LoginRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["Auth"])

COOKIE_NAME = "fpna_access_token"


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _set_auth_cookie(response: Response, token: str, max_age: int) -> None:
    settings = get_settings()
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=max_age,
        path="/",
        domain=settings.cookie_domain,
    )


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("SELECT id, email, hashed_password, full_name, role, is_active FROM users WHERE email = :email"),
        {"email": req.email},
    )
    user = result.mappings().first()

    if not user or not verify_password(req.password, user["hashed_password"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    if not user["is_active"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account disabled")

    settings = get_settings()
    max_age = settings.jwt_expire_minutes * 60
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    token = jwt.encode(
        {
            "sub": str(user["id"]),
            "email": user["email"],
            "role": user["role"],
            "full_name": user["full_name"],
            "exp": expire,
        },
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )

    _set_auth_cookie(response, token, max_age)

    return TokenResponse(
        access_token=token,
        expires_in=max_age,
        user={"id": user["id"], "email": user["email"], "full_name": user["full_name"], "role": user["role"]},
    )


@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    return {
        "id": user.get("sub"),
        "email": user.get("email"),
        "full_name": user.get("full_name", ""),
        "role": user.get("role"),
    }


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(key=COOKIE_NAME, path="/")
    return {"status": "ok"}
