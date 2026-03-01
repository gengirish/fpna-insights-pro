import pytest


@pytest.mark.asyncio
async def test_login_valid_credentials(client):
    resp = await client.post("/api/v1/auth/login", json={
        "email": "admin@fpna.local",
        "password": "admin123",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["user"]["email"] == "admin@fpna.local"
    assert "fpna_access_token" in resp.cookies


@pytest.mark.asyncio
async def test_login_invalid_credentials(client):
    resp = await client.post("/api/v1/auth/login", json={
        "email": "admin@fpna.local",
        "password": "wrongpassword",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_invalid_email_format(client):
    resp = await client.post("/api/v1/auth/login", json={
        "email": "notanemail",
        "password": "admin123",
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_auth_me_unauthenticated(client):
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_auth_me_with_cookie(client):
    login_resp = await client.post("/api/v1/auth/login", json={
        "email": "admin@fpna.local",
        "password": "admin123",
    })
    assert login_resp.status_code == 200

    cookie = login_resp.cookies.get("fpna_access_token")
    resp = await client.get("/api/v1/auth/me", cookies={"fpna_access_token": cookie})
    assert resp.status_code == 200
    assert resp.json()["email"] == "admin@fpna.local"


@pytest.mark.asyncio
async def test_logout(client):
    resp = await client.post("/api/v1/auth/logout")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
