# ============================================================================
# HAOYAO 后端：pytest 共享夹具
# 功能：为测试提供"独立临时数据库 + 重建引擎 + 应用客户端"的隔离环境，
#       确保测试不污染开发/生产数据库。
# 依据：《HAOYAO_官网_项目开发实施方案.md》§7 测试与质量门禁总纲：
#   - 每个里程碑交付测试用例文档，M1 覆盖环境冒烟 / DB 初始化 / 健康检查
# 隔离策略：
#   1. monkeypatch 修改 settings.DATABASE_URL 指向 pytest 临时目录
#   2. 重建 db 模块的 engine / SessionLocal（监听器随之重新绑定）
#   3. 调用 init_db() 完成建表 + 种子 + 管理员
#   4. 通过 dependency_overrides 让路由使用测试会话工厂
# ============================================================================

from __future__ import annotations

import os
from collections.abc import Generator
from pathlib import Path

import pytest
from app.core import db as db_module
from app.core.config import settings
from app.core.db import get_db
from app.core.init_db import init_db
from app.main import app
from app.services.rate_limit import rate_limiter
from fastapi.testclient import TestClient


def _sqlite_url(path: Path) -> str:
    """将临时文件路径转为 SQLAlchemy sqlite URL（统一正斜杠，兼容 Windows）。"""
    return f"sqlite:///{str(path).replace(os.sep, '/')}"


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Generator[TestClient, None, None]:
    """应用测试客户端（隔离数据库）。

    使用方式：测试函数参数声明 client，如 `def test_health(client): ...`。
    """
    # 1) 将 DATABASE_URL 指向 pytest 临时目录下的测试库
    test_db_path = tmp_path / "test_haoyao.db"
    monkeypatch.setattr(settings, "DATABASE_URL", _sqlite_url(test_db_path))

    # 2) 重建引擎与会话工厂（PRAGMA 监听器随 _make_engine 重新绑定）
    db_module.engine = db_module._make_engine()
    db_module.SessionLocal.configure(bind=db_module.engine)

    # 3) 初始化测试库：建表 + 种子 + 管理员（与生产启动路径一致）
    init_db()

    # 4) 用测试会话工厂覆盖路由依赖 get_db
    def override_get_db():
        db = db_module.SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    # 清理：移除依赖覆盖，避免影响其他测试
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """每个测试前后清空登录限流状态（模块级单例，避免测试间互相污染）。"""
    rate_limiter._store.clear()
    yield
    rate_limiter._store.clear()


@pytest.fixture()
def admin_headers(client: TestClient) -> dict[str, str]:
    """已登录管理员的认证头（Bearer access token）。

    前置：client 夹具完成种子与管理员创建（开发默认 admin / change-me）。
    """
    resp = client.post(
        "/api/v1/admin/auth/login",
        json={"username": "admin", "password": "change-me"},
    )
    assert resp.status_code == 200, resp.text
    token = resp.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}
