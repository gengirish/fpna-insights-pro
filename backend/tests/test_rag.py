import pytest


async def _get_auth_cookie(client) -> str:
    resp = await client.post("/api/v1/auth/login", json={
        "email": "admin@fpna.local",
        "password": "admin123",
    })
    return resp.cookies.get("fpna_access_token", "")


@pytest.mark.asyncio
async def test_rag_requires_auth(client):
    resp = await client.post("/api/v1/rag/query", json={
        "query": "What is the budget variance?",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_rag_query_valid(client):
    cookie = await _get_auth_cookie(client)
    resp = await client.post(
        "/api/v1/rag/query",
        json={"query": "What is the total budget for 2025?"},
        cookies={"fpna_access_token": cookie},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "llm_response" in data
    assert "postgres_data" in data
    assert "sources" in data


@pytest.mark.asyncio
async def test_rag_query_too_short(client):
    cookie = await _get_auth_cookie(client)
    resp = await client.post(
        "/api/v1/rag/query",
        json={"query": "hi"},
        cookies={"fpna_access_token": cookie},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_rag_query_invalid_table(client):
    cookie = await _get_auth_cookie(client)
    resp = await client.post(
        "/api/v1/rag/query",
        json={"query": "What is the total?", "tables": ["users"]},
        cookies={"fpna_access_token": cookie},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_rag_query_sql_injection_blocked(client):
    cookie = await _get_auth_cookie(client)
    resp = await client.post(
        "/api/v1/rag/query",
        json={"query": "Show data; DROP TABLE users;"},
        cookies={"fpna_access_token": cookie},
    )
    assert resp.status_code == 422
