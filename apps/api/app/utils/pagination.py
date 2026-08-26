# ============================================================================
# HAOYAO 后端：统一分页工具
# 功能：分页参数规范化 + Select 查询分页封装，全站列表接口统一分页结构。
# 依据：《HAOYAO_官网_开发技术文档.md》§5.5：
#   - 分页结构：{total, page, page_size, items}
#   - page 从 1 起；默认 page_size：前台 12 / 资讯 9 / 后台 20，上限 100
# 实现说明：SQLAlchemy 2.0 的 Select 无 count()/all() 方法（1.x Query 才有），
#   因此本封装接收 session，以 count 子查询统计总量、scalars 取结果。
# ============================================================================

from __future__ import annotations

from typing import Any

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

# 各场景默认分页大小（代码常量承载，数据库文档 §4.12 分页决策）
DEFAULT_PAGE_SIZE_FRONT = 12    # 前台产品列表
DEFAULT_PAGE_SIZE_NEWS = 9      # 资讯列表
DEFAULT_PAGE_SIZE_ADMIN = 20    # 后台列表
MAX_PAGE_SIZE = 100             # 全局上限


def normalize_page(page: int | None, page_size: int | None, default_size: int) -> tuple[int, int]:
    """规范化分页参数。

    规则：
      - page 从 1 起，非法值（≤0）回退 1
      - page_size 非法值回退默认值；超过 MAX_PAGE_SIZE 时截断为上限
    """
    if page is None or page < 1:
        page = 1
    if page_size is None or page_size < 1:
        page_size = default_size
    if page_size > MAX_PAGE_SIZE:
        page_size = MAX_PAGE_SIZE
    return page, page_size


def paginate(session: Session, query: Select, page: int, page_size: int) -> dict[str, Any]:
    """对 Select 查询执行分页并返回统一结构。

    参数：
        session: 数据库会话（执行查询）
        query: 未经 offset/limit 的 Select 查询对象
        page: 页码（从 1 起）
        page_size: 每页条数

    说明：
      - total 使用 count 子查询（select_from(query.subquery())），不加载全量数据
      - items 为 ORM 标量对象列表，由路由层负责序列化（schemas 转换）
    """
    # 统计总数：以当前查询为子查询计数
    total_stmt = select(func.count()).select_from(query.subquery())
    total = session.execute(total_stmt).scalar_one()

    # 分页查询：offset/limit 作用于原查询
    stmt = query.offset((page - 1) * page_size).limit(page_size)
    # unique()：查询含 joinedload 集合加载（如 Product.images）时，
    # SQLAlchemy 2.0 强制要求对结果去重（行级唯一）；无集合加载时无副作用
    items = session.execute(stmt).unique().scalars().all()

    return {
        "total": int(total),
        "page": page,
        "page_size": page_size,
        "items": items,
    }
