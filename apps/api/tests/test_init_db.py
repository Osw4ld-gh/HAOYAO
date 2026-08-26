# ============================================================================
# HAOYAO 后端：数据库初始化与种子数据完整性测试
# 用例编号：M1-DB-001 ~ M1-DB-009
# 对应《M1_测试用例.md》"DB 初始化"与"种子数据完整性"模块
# ============================================================================

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest
from app.core import db as db_module
from app.core.config import settings
from app.core.init_db import init_db
from app.core.security import verify_password
from app.models import AdminUser
from fastapi.testclient import TestClient


def _raw_conn() -> sqlite3.Connection:
    """打开测试库的原始连接（用于 sqlite_master 等元数据/种子校验）。"""
    db_path = settings.DATABASE_URL.replace("sqlite:///", "", 1)
    return sqlite3.connect(db_path)


def _table_names() -> set[str]:
    """返回库内全部业务表名（排除 sqlite_ 内部表）。"""
    with _raw_conn() as conn:
        rows = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        ).fetchall()
    return {r[0] for r in rows}


def _row_count(table: str) -> int:
    """返回指定表的行数。"""
    with _raw_conn() as conn:
        row = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()
    return int(row[0])


# 数据库设计文档 §5.2：13 张表全量清单
EXPECTED_TABLES = {
    "admin_user",
    "top_category",
    "sub_category",
    "product",
    "product_image",
    "article",
    "story",
    "timeline",
    "navigation",
    "banner",
    "site_setting",
    "media_asset",
    "audit_log",
}


def test_init_db_creates_all_tables(client: TestClient) -> None:
    """M1-DB-001：初始化后 13 张表全部存在。

    前置：client 夹具完成 init_db。
    预期：库内表集合与 EXPECTED_TABLES 完全一致。
    """
    assert _table_names() == EXPECTED_TABLES


def test_init_db_idempotent(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """M1-DB-002：init_db 幂等——重复执行不报错、不产生重复数据。

    前置：临时库初始化一次。
    步骤：再次调用 init_db()。
    预期：无异常；表数量仍为 13；种子行数不变。
    """
    # 独立临时库（不复用 client，避免状态干扰）
    test_db = tmp_path / "idem.db"
    monkeypatch.setattr(settings, "DATABASE_URL", f"sqlite:///{test_db.as_posix()}")
    db_module.engine = db_module._make_engine()
    db_module.SessionLocal.configure(bind=db_module.engine)

    init_db()
    assert len(_table_names()) == 13
    nav_count_before = _row_count("navigation")

    init_db()  # 第二次执行：应跳过建表且不重复种子
    assert len(_table_names()) == 13
    assert _row_count("navigation") == nav_count_before


def test_seed_top_categories(client: TestClient) -> None:
    """M1-DB-003：顶层分类种子 3 行（fragrance/makeup/skincare）。

    依据：数据库设计文档 §9.2。
    """
    with _raw_conn() as conn:
        rows = conn.execute("SELECT slug, sort, enabled FROM top_category ORDER BY sort").fetchall()
    assert [(r[0], r[1], r[2]) for r in rows] == [
        ("fragrance", 1, 1),
        ("makeup", 2, 1),
        ("skincare", 3, 1),
    ]


def test_seed_sub_categories(client: TestClient) -> None:
    """M1-DB-004：二级分类种子 12 行（含双语名称）。

    依据：数据库设计文档 §9.3。
    """
    assert _row_count("sub_category") == 12
    with _raw_conn() as conn:
        row = conn.execute(
            "SELECT name_json FROM sub_category WHERE top_id=3 AND slug='serum'"
        ).fetchone()
    # 双语 JSON 结构校验
    assert row is not None
    import json

    name = json.loads(row[0])
    assert name == {"zh": "精华", "en": "Serums"}


def test_seed_navigation(client: TestClient) -> None:
    """M1-DB-005：导航种子 11 行（6 顶层 + 5 二级，演示导航驱动）。

    依据：数据库设计文档 §9.4。
    """
    assert _row_count("navigation") == 11
    with _raw_conn() as conn:
        top_count = conn.execute(
            "SELECT COUNT(*) FROM navigation WHERE parent_id IS NULL"
        ).fetchone()
        child_count = conn.execute(
            "SELECT COUNT(*) FROM navigation WHERE parent_id IS NOT NULL"
        ).fetchone()
    assert int(top_count[0]) == 6
    assert int(child_count[0]) == 5


def test_seed_site_settings(client: TestClient) -> None:
    """M1-DB-006：网站配置 4 键齐全（contact/seo/switches/featured_products）。

    依据：数据库设计文档 §9.5。
    """
    with _raw_conn() as conn:
        keys = {r[0] for r in conn.execute("SELECT key FROM site_setting").fetchall()}
    assert keys == {"contact", "seo", "switches", "featured_products"}


def test_seed_content_placeholders(client: TestClient) -> None:
    """M1-DB-007：内容占位种子（story 1 行 / timeline 2 条 / article 2 条 / banner 1 张）。

    依据：数据库设计文档 §9.6（article 含 1 草稿 + 1 已发布演示状态机）。
    """
    assert _row_count("story") == 1
    assert _row_count("timeline") == 2
    assert _row_count("article") == 2
    assert _row_count("banner") == 1

    with _raw_conn() as conn:
        statuses = {
            r[0] for r in conn.execute("SELECT status FROM article").fetchall()
        }
        published_nonnull = conn.execute(
            "SELECT COUNT(*) FROM article WHERE status='published' AND published_at IS NOT NULL"
        ).fetchone()
        draft_null = conn.execute(
            "SELECT COUNT(*) FROM article WHERE status='draft' AND published_at IS NULL"
        ).fetchone()
    # 状态机种子：draft 与 published 各一，published 必须有 published_at
    assert statuses == {"draft", "published"}
    assert int(published_nonnull[0]) == 1
    assert int(draft_null[0]) == 1


def test_seed_products_empty(client: TestClient) -> None:
    """M1-DB-008：产品/产品图片/媒体/审计默认不预置（由后台录入）。

    依据：数据库设计文档 §9.6。
    """
    assert _row_count("product") == 0
    assert _row_count("product_image") == 0
    assert _row_count("media_asset") == 0
    assert _row_count("audit_log") == 0


def test_admin_created_with_real_hash(client: TestClient) -> None:
    """M1-DB-009：管理员首启创建，密码为真实 BCrypt 哈希且可校验。

    依据：方案 §6 —— 首启由 ADMIN_USERNAME/ADMIN_PASSWORD_INIT 自动创建。
    """
    from app.core.db import SessionLocal

    with SessionLocal() as db:
        admin = db.query(AdminUser).filter(AdminUser.username == settings.ADMIN_USERNAME).first()
        assert admin is not None
        # 占位哈希必须被真实哈希覆盖
        assert not admin.password_hash.startswith("<")
        # 初始密码（开发默认 admin/change-me）校验通过
        assert verify_password(settings.ADMIN_PASSWORD_INIT, admin.password_hash)
