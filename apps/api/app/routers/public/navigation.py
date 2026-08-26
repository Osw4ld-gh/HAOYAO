# ============================================================================
# HAOYAO 后端：前台公开接口 —— 导航（SSR 实时拉取，不缓存）
# 功能：GET /api/v1/navigation —— 返回启用状态的导航树（含二级）。
# 依据：《HAOYAO_官网_开发技术文档.md》§6.4.1 / UI 规范 §6.3：
#   - 仅返回 enabled=1 且按 sort 升序
#   - 前台导航 SSR 实时拉取（不依赖 ISR，后台修改即时生效）
# ============================================================================

# mypy: disable-error-code="no-untyped-def"
# 说明：FastAPI 路由返回类型由 OpenAPI 自动处理，故豁免该规则。

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...core.db import get_db
from ...models import Navigation
from ...utils.response import ok

router = APIRouter(prefix="/navigation", tags=["public-navigation"])


def _serialize(item: Navigation) -> dict:
    """导航节点序列化（label_json → 双语结构）。"""
    return {
        "id": item.id,
        "label": item.label_json,
        "link_type": item.link_type,
        "link_value": item.link_value,
        "children": [],
    }


@router.get("")
def get_navigation(db: Session = Depends(get_db)):
    """导航树（前台）：仅启用项，内存组装父子结构。

    说明：全表 ≤30 行一次拉取（数据库文档 §6 导航树查询），
    后台修改后此处实时反映（无缓存）。
    """
    items = (
        db.query(Navigation)
        .filter(Navigation.enabled.is_(True))
        .order_by(Navigation.sort, Navigation.id)
        .all()
    )
    by_parent: dict[int | None, list[Navigation]] = {}
    for item in items:
        by_parent.setdefault(item.parent_id, []).append(item)

    def build(parent_id: int | None) -> list[dict]:
        nodes = []
        for item in by_parent.get(parent_id, []):
            node = _serialize(item)
            node["children"] = build(item.id)
            nodes.append(node)
        return nodes

    return ok(build(None))
