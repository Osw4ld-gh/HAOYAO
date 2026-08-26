# ============================================================================
# HAOYAO 后端：前台公开接口 —— 分类树
# 功能：GET /api/v1/categories —— 顶层分类 + 二级分类树。
# 依据：《HAOYAO_官网_开发技术文档.md》§6.4.5：
#   - 驱动前台列表页 Tab 与面包屑（slug / 双语名称）
#   - 仅返回 enabled=1 的顶层分类
# ============================================================================

# mypy: disable-error-code="no-untyped-def"
# 说明：FastAPI 路由返回类型由 OpenAPI 自动处理，故豁免该规则。

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...core.db import get_db
from ...models import SubCategory, TopCategory
from ...utils.response import ok

router = APIRouter(prefix="/categories", tags=["public-categories"])


@router.get("")
def get_categories(db: Session = Depends(get_db)):
    """分类树：顶层（启用）→ 二级（含 slug / 双语名称）。"""
    tops = (
        db.query(TopCategory)
        .filter(TopCategory.enabled.is_(True))
        .order_by(TopCategory.sort, TopCategory.id)
        .all()
    )
    data = []
    for top in tops:
        subs = (
            db.query(SubCategory)
            .filter(SubCategory.top_id == top.id)
            .order_by(SubCategory.sort, SubCategory.id)
            .all()
        )
        data.append(
            {
                "id": top.id,
                "slug": top.slug,
                "sort": top.sort,
                # 顶层分类无独立名称字段，展示名由导航表提供（数据库文档 D4）；
                # 此处返回 slug 供前端组合，导航层提供展示名
                "children": [
                    {
                        "id": s.id,
                        "slug": s.slug,
                        "name": s.name_json,
                        "sort": s.sort,
                    }
                    for s in subs
                ],
            }
        )
    return ok(data)
