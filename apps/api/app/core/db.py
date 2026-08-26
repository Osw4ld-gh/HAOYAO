# ============================================================================
# HAOYAO 后端：数据库访问层
# 功能：创建 SQLAlchemy engine / SessionLocal，并通过 connect 事件为
#       SQLite 连接统一设置 PRAGMA（WAL / busy_timeout / 外键）。
# 依据：《HAOYAO_官网_开发技术文档.md》§4.7：
#   - SQLite 连接池配置：check_same_thread=False + pool_pre_ping
#   - 应用运行时连接必须开启 WAL / busy_timeout=5000 / foreign_keys=ON
#     （CLI 初始化路径由 SQL 脚本内的 PRAGMA 负责，两条路径缺一不可）
# 可测试性：engine/SessionLocal 为模块级变量；测试可调用 _make_engine()
#           重建引擎并 configure 会话工厂，实现测试库隔离。
# ============================================================================

from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from .config import settings


def _set_sqlite_pragma(dbapi_connection: object, _: object) -> None:
    """连接事件处理函数：为每个 SQLite 连接设置运行期 PRAGMA。

    说明：journal_mode=WAL 必须在无活动事务时执行，connect 事件是安全时点。
    """
    cursor = dbapi_connection.cursor()  # type: ignore[attr-defined]
    # WAL 模式：提升并发读性能（数据库文档 §2.1 P3）
    cursor.execute("PRAGMA journal_mode=WAL")
    # 写锁等待 5 秒，避免并发写直接报 database is locked
    cursor.execute("PRAGMA busy_timeout=5000")
    # 外键约束生效（SQLite 默认关闭，必须显式开启）
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def _make_engine() -> Engine:
    """创建 SQLAlchemy 引擎（含 SQLite PRAGMA 监听器绑定）。

    - check_same_thread=False：允许 FastAPI 线程池中的线程共用连接
    - pool_pre_ping=True：取出连接前探活，避免失效连接报错
    """
    # SQLite 专用连接参数仅在 sqlite 方言下生效（PostgreSQL 迁移时忽略）
    connect_args = (
        {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
    )
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args=connect_args,
        pool_pre_ping=True,
    )
    # 将 PRAGMA 监听器绑定到本次创建的引擎（测试重建引擎时同样生效）
    event.listen(engine, "connect", _set_sqlite_pragma)
    return engine


# 模块级引擎与会话工厂：应用运行时使用；测试通过重建实现隔离
engine = _make_engine()
# 会话工厂：autoflush=False（显式控制 flush 时机），供 get_db 依赖使用
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db() -> Generator[Session, None, None]:
    """FastAPI 依赖注入：提供请求级数据库会话。

    用法：路由函数参数声明 `db: Session = Depends(get_db)`。
    请求结束时统一关闭会话（连接归还连接池）。
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
