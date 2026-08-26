# ============================================================================
# HAOYAO 后端：认证与鉴权接口测试
# 用例编号：M2-AUTH-001 ~ M2-AUTH-008（认证 8 例）
#           M2-AUTHZ-001 ~ M2-AUTHZ-003（鉴权 3 例）
# 对应《M2_测试用例.md》"认证"与"鉴权"模块
# ============================================================================

from __future__ import annotations

import jwt
from app.core.config import settings
from app.services.rate_limit import rate_limiter
from fastapi.testclient import TestClient

# ============================================================================
# 认证（M2-AUTH）
# ============================================================================


def test_login_success(client: TestClient) -> None:
    """M2-AUTH-001：登录成功 → 200 + access_token + Set-Cookie refresh。

    前置：管理员已由 init_db 创建（admin / change-me）。
    预期：响应含 access_token；Set-Cookie 含 refresh_token（HttpOnly）。
    """
    resp = client.post(
        "/api/v1/admin/auth/login",
        json={"username": "admin", "password": "change-me"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    assert body["data"]["access_token"]
    assert body["data"]["expires_in"] == settings.JWT_ACCESS_TTL_MINUTES * 60
    # Refresh Cookie 写入（HttpOnly + SameSite=Lax）
    set_cookie = resp.headers.get("set-cookie", "")
    assert "refresh_token=" in set_cookie
    assert "HttpOnly" in set_cookie


def test_login_wrong_password(client: TestClient) -> None:
    """M2-AUTH-002：密码错误 → 401 / 40102 + 剩余次数提示。"""
    resp = client.post(
        "/api/v1/admin/auth/login",
        json={"username": "admin", "password": "wrong-pass"},
    )
    assert resp.status_code == 401
    body = resp.json()
    assert body["code"] == 40102
    assert "剩余" in body["message"]


def test_login_lock_after_failures(monkeypatch, client: TestClient) -> None:
    """M2-AUTH-003：连续失败达阈值 → 423 / 40103 锁定（含解锁时间）。

    说明：临时调低阈值（2 次）加速验证；锁定后即使密码正确也拒绝。
    """
    monkeypatch.setattr(rate_limiter, "MAX_FAILURES", 2)
    # 连续 2 次失败 → 触发锁定
    for _ in range(2):
        resp = client.post(
            "/api/v1/admin/auth/login",
            json={"username": "admin", "password": "wrong-pass"},
        )
    assert resp.status_code == 423
    body = resp.json()
    assert body["code"] == 40103
    assert "locked_until" in body["data"]


def test_login_rejected_when_locked(monkeypatch, client: TestClient) -> None:
    """M2-AUTH-004：锁定期间即使密码正确也被拒绝（不泄露密码正确性）。"""
    monkeypatch.setattr(rate_limiter, "MAX_FAILURES", 1)
    # 1 次失败即锁定
    client.post(
        "/api/v1/admin/auth/login", json={"username": "admin", "password": "bad"}
    )
    # 锁定中：正确密码同样 423
    resp = client.post(
        "/api/v1/admin/auth/login", json={"username": "admin", "password": "change-me"}
    )
    assert resp.status_code == 423
    assert resp.json()["code"] == 40103


def test_login_lock_expires(monkeypatch, client: TestClient) -> None:
    """M2-AUTH-005：锁定到期后恢复登录。

    说明：限流器以 time.time() 判断锁定是否过期，无法快速等待 15 分钟，
    因此通过清空限流状态模拟"锁定过期后的状态恢复"。
    """
    monkeypatch.setattr(rate_limiter, "MAX_FAILURES", 1)
    # 1 次失败即触发锁定（LOCK_MINUTES 保持默认 15）
    client.post(
        "/api/v1/admin/auth/login", json={"username": "admin", "password": "bad"}
    )
    # 锁定期间：正确密码同样 423
    locked = client.post(
        "/api/v1/admin/auth/login", json={"username": "admin", "password": "change-me"}
    )
    assert locked.status_code == 423
    # 模拟锁定过期（限流状态清空，等价于时间流逝后记录被清理）
    rate_limiter._store.clear()
    resp = client.post(
        "/api/v1/admin/auth/login", json={"username": "admin", "password": "change-me"}
    )
    assert resp.status_code == 200


def test_login_unknown_user(client: TestClient) -> None:
    """M2-AUTH-006：用户名不存在 → 401 / 40102（不泄露用户是否存在）。"""
    resp = client.post(
        "/api/v1/admin/auth/login",
        json={"username": "nobody", "password": "whatever"},
    )
    assert resp.status_code == 401
    assert resp.json()["code"] == 40102


def test_refresh_success(client: TestClient) -> None:
    """M2-AUTH-007：携带 refresh Cookie 刷新 → 新 access_token（并轮换）。"""
    # 登录获取 refresh Cookie
    login = client.post(
        "/api/v1/admin/auth/login", json={"username": "admin", "password": "change-me"}
    )
    assert login.status_code == 200

    # 携带 Cookie 调 refresh（TestClient 自动保留 cookie）
    resp = client.post("/api/v1/admin/auth/refresh")
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    assert body["data"]["access_token"]
    # 轮换：Set-Cookie 再次写入新 refresh
    assert "refresh_token=" in resp.headers.get("set-cookie", "")


def test_refresh_without_cookie(client: TestClient) -> None:
    """M2-AUTH-008：无 refresh Cookie 刷新 → 401 / 40100。"""
    resp = client.post("/api/v1/admin/auth/refresh")
    assert resp.status_code == 401
    assert resp.json()["code"] == 40100


def test_logout_clears_cookie(client: TestClient, admin_headers: dict) -> None:
    """M2-AUTH-009：登出 → 清除 refresh Cookie + 审计 logout。"""
    resp = client.post("/api/v1/admin/auth/logout", headers=admin_headers)
    assert resp.status_code == 200
    # Set-Cookie 清除指令（Max-Age=0）
    set_cookie = resp.headers.get("set-cookie", "")
    assert "refresh_token=" in set_cookie and "Max-Age=0" in set_cookie

    # 审计落库（M6 才有审计查询接口，此处直接查库验证）
    from app.core.db import SessionLocal
    from app.models import AuditLog

    with SessionLocal() as db:
        actions = [a.action for a in db.query(AuditLog).all()]
    assert "login" in actions and "logout" in actions


# ============================================================================
# 鉴权（M2-AUTHZ）
# ============================================================================


def test_admin_api_without_token(client: TestClient) -> None:
    """M2-AUTHZ-001：无 token 访问后台接口 → 401 / 40100。"""
    resp = client.get("/api/v1/admin/navigation")
    assert resp.status_code == 401
    assert resp.json()["code"] == 40100


def test_admin_api_invalid_token(client: TestClient) -> None:
    """M2-AUTHZ-002：无效 token → 401 / 40100。"""
    resp = client.get(
        "/api/v1/admin/navigation", headers={"Authorization": "Bearer not-a-jwt"}
    )
    assert resp.status_code == 401
    assert resp.json()["code"] == 40100


def test_admin_api_expired_token(client: TestClient) -> None:
    """M2-AUTHZ-003：过期 token → 401 / 40101。"""
    # 构造已过期 1 分钟的 access token（绕开创建函数，直接签名）
    import datetime as dt

    now = dt.datetime.now(dt.UTC)
    expired_payload = {
        "sub": "admin",
        "typ": "access",
        "iat": now - dt.timedelta(minutes=30),
        "exp": now - dt.timedelta(minutes=1),
    }
    expired_token = jwt.encode(expired_payload, settings.JWT_SECRET, algorithm="HS256")
    resp = client.get(
        "/api/v1/admin/navigation", headers={"Authorization": f"Bearer {expired_token}"}
    )
    assert resp.status_code == 401
    assert resp.json()["code"] == 40101


def test_admin_api_refresh_token_misuse(client: TestClient) -> None:
    """M2-AUTHZ-004：refresh token 冒用为 access → 401 / 40100。"""
    from app.core.security import create_refresh_token

    refresh_token = create_refresh_token("admin")
    resp = client.get(
        "/api/v1/admin/navigation",
        headers={"Authorization": f"Bearer {refresh_token}"},
    )
    assert resp.status_code == 401
    assert resp.json()["code"] == 40100
