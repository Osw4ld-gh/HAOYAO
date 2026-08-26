# ============================================================================
# HAOYAO 后端：数据库初始化（DDL + 种子 + 管理员首启）
# 功能：应用首次启动时执行《scripts/sql/haoyao_schema.sql》（唯一 DDL 源），
#       并以环境变量 ADMIN_USERNAME / ADMIN_PASSWORD_INIT 创建管理员账号。
# 依据：
#   - 《HAOYAO_官网_数据库设计文档.md》§8.3：create_all 或 SQL 脚本初始化，
#     scripts/sql/haoyao_schema.sql 为唯一 DDL 源（P4 原则）
#   - 方案 §6：管理员首启由 ADMIN_USERNAME/ADMIN_PASSWORD_INIT 自动创建
# 幂等性：库已初始化（存在任意业务表）时跳过建表；管理员 upsert 可重复执行。
# ============================================================================

from __future__ import annotations

import sqlite3
from pathlib import Path

from sqlalchemy.orm import Session

from ..models import AdminUser
from .config import settings
from .db import SessionLocal
from .security import hash_password

# 定位仓库根目录：本文件 apps/api/app/core/init_db.py → 上溯 4 级到仓库根
REPO_ROOT = Path(__file__).resolve().parents[4]
# 唯一 DDL 源脚本路径（与方案 §3 保持一致）
SCHEMA_SQL_PATH = REPO_ROOT / "scripts" / "sql" / "haoyao_schema.sql"

# 占位哈希标记：schema 脚本中的管理员占位值，首启时将被真实 BCrypt 哈希覆盖
_PLACEHOLDER_HASH = "<bcrypt_hash_placeholder>"


def _db_is_initialized() -> bool:
    """判断数据库是否已初始化：存在任意业务表即为已初始化。

    说明：通过 SQLite sqlite_master 查询表数量，避免重复执行建表脚本报错。
    """
    # 解析 DATABASE_URL（sqlite:///path）取出文件路径
    db_path = settings.DATABASE_URL.replace("sqlite:///", "", 1)
    # 相对路径转为绝对路径（相对进程工作目录，与 SQLAlchemy 行为一致）
    if not Path(db_path).is_absolute():
        db_path = str(Path(db_path).resolve())

    if not Path(db_path).exists():
        return False

    # 连接查询 sqlite_master：无表则未初始化
    with sqlite3.connect(db_path) as conn:
        row = conn.execute(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        ).fetchone()
        return bool(row and row[0] > 0)


def _exec_schema_script() -> None:
    """执行建表 SQL 脚本（DDL + 索引 + 种子数据）。

    说明：此处使用 sqlite3 标准库直连执行脚本——初始化属于建库动作，
    不属于运行时数据访问（运行时数据访问一律走 ORM，P4 原则）。
    """
    if not SCHEMA_SQL_PATH.exists():
        raise FileNotFoundError(f"DDL 脚本不存在: {SCHEMA_SQL_PATH}")

    # 解析出 sqlite 文件路径（与 _db_is_initialized 相同逻辑）
    db_path = settings.DATABASE_URL.replace("sqlite:///", "", 1)
    if not Path(db_path).is_absolute():
        db_path = str(Path(db_path).resolve())

    # 确保父目录存在（如 data/haoyao.db）
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(db_path) as conn:
        # executescript 可一次执行多语句脚本（自动提交）
        conn.executescript(SCHEMA_SQL_PATH.read_text(encoding="utf-8"))


def _ensure_admin(db: Session) -> None:
    """确保管理员账号存在且密码为真实 BCrypt 哈希（幂等）。

    流程：
      1. 查询用户名匹配的管理员
      2. 不存在 → 用 ADMIN_PASSWORD_INIT 创建
      3. 存在但密码为占位哈希 → 更新为真实哈希（开发默认 admin/change-me）
      4. 已就绪 → 跳过
    """
    admin = db.query(AdminUser).filter(AdminUser.username == settings.ADMIN_USERNAME).first()

    if admin is None:
        # 首次创建管理员（种子脚本中的占位行用户名也是 admin，正常情况下会走更新分支）
        db.add(
            AdminUser(
                username=settings.ADMIN_USERNAME,
                password_hash=hash_password(settings.ADMIN_PASSWORD_INIT),
            )
        )
        db.commit()
        return

    if admin.password_hash == _PLACEHOLDER_HASH or admin.password_hash.startswith("<"):
        # 占位哈希：覆盖为环境变量指定的初始密码
        admin.password_hash = hash_password(settings.ADMIN_PASSWORD_INIT)
        db.commit()


def init_db() -> None:
    """应用启动初始化入口（在 FastAPI lifespan 中调用）。

    幂等策略：
      - 数据库已初始化 → 仅确保管理员就绪
      - 数据库未初始化 → 执行 schema 脚本（建表+索引+种子）后再确保管理员
    """
    if not _db_is_initialized():
        _exec_schema_script()

    # 管理员 upsert 走 ORM（数据访问统一经 ORM 的体现）
    with SessionLocal() as db:
        _ensure_admin(db)
