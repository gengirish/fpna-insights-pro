from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, status, Depends, Response, Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
import bcrypt
from jose import jwt
from app.config import get_settings
from app.dependencies import get_db, get_current_user
from app.models.schemas import (
    LoginRequest, TokenResponse,
    ApiKeysResponse, ApiKeyEntry, ApiKeyUpdate, ApiKeyDelete,
)
from app.services.encryption import encrypt_api_key, decrypt_api_key, mask_key

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
        samesite=settings.cookie_samesite,
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


# --- BYOK Settings ---


@router.get("/settings/api-keys", response_model=ApiKeysResponse)
async def get_api_keys(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    settings = get_settings()
    user_id = int(user["sub"])

    result = await db.execute(
        text("SELECT provider, encrypted_key, model_preference FROM user_api_keys WHERE user_id = :uid"),
        {"uid": user_id},
    )
    rows = result.mappings().all()

    keys = []
    for row in rows:
        try:
            plain = decrypt_api_key(row["encrypted_key"], settings.jwt_secret)
            keys.append(ApiKeyEntry(
                provider=row["provider"],
                masked_key=mask_key(plain),
                model_preference=row["model_preference"],
            ))
        except Exception:
            keys.append(ApiKeyEntry(
                provider=row["provider"],
                masked_key="****invalid****",
                model_preference=row["model_preference"],
            ))

    return ApiKeysResponse(
        keys=keys,
        server_has_openrouter=bool(settings.openrouter_api_key),
        server_has_perplexity=bool(settings.perplexity_api_key),
    )


@router.put("/settings/api-keys")
async def upsert_api_key(
    body: ApiKeyUpdate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    settings = get_settings()
    user_id = int(user["sub"])
    encrypted = encrypt_api_key(body.api_key, settings.jwt_secret)

    await db.execute(
        text("""
            INSERT INTO user_api_keys (user_id, provider, encrypted_key, model_preference, updated_at)
            VALUES (:uid, :provider, :key, :model, NOW())
            ON CONFLICT (user_id, provider)
            DO UPDATE SET encrypted_key = :key, model_preference = :model, updated_at = NOW()
        """),
        {"uid": user_id, "provider": body.provider, "key": encrypted, "model": body.model_preference},
    )

    return {"status": "ok", "provider": body.provider}


@router.delete("/settings/api-keys")
async def delete_api_key(
    body: ApiKeyDelete,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    user_id = int(user["sub"])

    await db.execute(
        text("DELETE FROM user_api_keys WHERE user_id = :uid AND provider = :provider"),
        {"uid": user_id, "provider": body.provider},
    )

    return {"status": "ok", "provider": body.provider}
