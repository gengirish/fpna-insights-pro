import pytest


async def _get_auth_cookie(client) -> str:
    resp = await client.post("/api/v1/auth/login", json={
        "email": "admin@fpna.local",
        "password": "admin123",
    })
    return resp.cookies.get("fpna_access_token", "")


@pytest.mark.asyncio
async def test_dashboard_requires_auth(client):
    resp = await client.get("/api/v1/dashboard/summary")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_dashboard_summary(client):
    cookie = await _get_auth_cookie(client)
    resp = await client.get(
        "/api/v1/dashboard/summary?fiscal_year=2025",
        cookies={"fpna_access_token": cookie},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "kpis" in data
    assert "budget_vs_actual" in data
    assert "dept_breakdown" in data


@pytest.mark.asyncio
async def test_ap_aging(client):
    cookie = await _get_auth_cookie(client)
    resp = await client.get(
        "/api/v1/dashboard/ap-aging",
        cookies={"fpna_access_token": cookie},
    )
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_ar_aging(client):
    cookie = await _get_auth_cookie(client)
    resp = await client.get(
        "/api/v1/dashboard/ar-aging",
        cookies={"fpna_access_token": cookie},
    )
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_expense_summary(client):
    cookie = await _get_auth_cookie(client)
    resp = await client.get(
        "/api/v1/dashboard/expense-summary",
        cookies={"fpna_access_token": cookie},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "by_category" in data
    assert "by_status" in data


@pytest.mark.asyncio
async def test_gl_summary(client):
    cookie = await _get_auth_cookie(client)
    resp = await client.get(
        "/api/v1/dashboard/gl-summary",
        cookies={"fpna_access_token": cookie},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "by_account" in data
    assert "by_dept" in data
    assert "monthly_trend" in data
