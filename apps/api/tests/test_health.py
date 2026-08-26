# ============================================================================
# HAOYAO 后端：健康检查接口测试
# 用例编号：M1-HEALTH-001 ~ M1-HEALTH-003
# 对应《M1_测试用例.md》"健康检查"模块
# ============================================================================

from __future__ import annotations

from fastapi.testclient import TestClient


def test_healthz_ok(client: TestClient) -> None:
    """M1-HEALTH-001：健康检查返回成功（code=0 且数据库连通）。

    前置：测试库初始化完成（client 夹具内完成）。
    预期：HTTP 200，body.code == 0，body.data.status == "ok"，db == "ok"。
    """
    resp = client.get("/healthz")
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    assert body["message"] == "healthy"
    assert body["data"] == {"status": "ok", "db": "ok"}


def test_docs_available(client: TestClient) -> None:
    """M1-HEALTH-002：OpenAPI 文档（/docs）可访问，接口契约骨架存在。

    前置：服务启动。
    预期：/docs 返回 200 且为 HTML；/openapi.json 包含 /healthz 路由。
    """
    resp_docs = client.get("/docs")
    assert resp_docs.status_code == 200
    assert "swagger" in resp_docs.text.lower()

    resp_openapi = client.get("/openapi.json")
    assert resp_openapi.status_code == 200
    paths = resp_openapi.json()["paths"]
    # OpenAPI 骨架须包含健康检查路由
    assert "/healthz" in paths


def test_unknown_path_404(client: TestClient) -> None:
    """M1-HEALTH-003：未注册路径返回 404（不误伤业务错误码体系）。

    前置：服务启动。
    预期：/api/v1/not-exist 返回 404。
    """
    resp = client.get("/api/v1/not-exist")
    assert resp.status_code == 404
