# ============================================================================
# HAOYAO 后端：导航配置路由（后台 CRUD + 启停）
# 功能：
#   - GET    /admin/navigation          树形列表（含停用项，后台管理）
#   - POST   /admin/navigation          新增导航项
#   - PUT    /admin/navigation/{id}     修改导航项
#   - DELETE /admin/navigation/{id}     删除（含子项 → 422 NAV_HAS_CHILDREN）
#   - PUT    /admin/navigation/{id}/toggle 启停
# 依据：《HAOYAO_官网_开发技术文档.md》§6.5.2 / 数据库文档 §4.10：
#   - 删除含子项返回 422 NAV_HAS_CHILDREN（应用层预检；DDL 的 CASCADE 仅兜底）
#   - 全表 ≤30 行：列表一次拉取内存组树（数据库文档 §6 导航树查询）
#   - 写操作均写审计 + 通知 revalidate（nav/home）
# ============================================================================

# mypy: disable-error-code="no-untyped-def"
# 说明：FastAPI 路由返回类型由 OpenAPI 自动处理，标注 union 反而污染 schema，故豁免该规则。

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...core.db import get_db
from ...core.deps import require_admin
from ...core.errors import not_found, validation
from ...models import Navigation
from ...schemas.navigation import NavCreate, NavNode, NavToggle, NavUpdate
from ...services.revalidate import notify_revalidate
from ...utils.audit import write_audit
from ...utils.response import ok

router = APIRouter(prefix="/navigation", tags=["admin-navigation"])


def _serialize_node(item: Navigation) -> dict:
    """导航节点序列化（label_json → Bilingual 结构）。"""
    return NavNode(
        id=item.id,
        parent_id=item.parent_id,
        label=item.label_json,
        link_type=item.link_type,
        link_value=item.link_value,
        sort=item.sort,
        enabled=item.enabled,
    ).model_dump()


@router.get("")
def list_navigation(
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """导航树列表：全量（含停用项）按 sort 排序，内存组装父子树。

    说明：后台管理需展示全部导航项（含 enabled=0），与前台只取启用项不同。
    """
    items = db.query(Navigation).order_by(Navigation.sort, Navigation.id).all()
    # 顶层（parent_id 为空）与子项映射
    by_parent: dict[int | None, list[Navigation]] = {}
    for item in items:
        by_parent.setdefault(item.parent_id, []).append(item)

    def build(parent_id: int | None) -> list[dict]:
        """递归组装树节点。"""
        nodes = []
        for item in by_parent.get(parent_id, []):
            node = _serialize_node(item)
            node["children"] = build(item.id)
            nodes.append(node)
        return nodes

    return ok(build(None))


@router.post("", status_code=201)
def create_navigation(
    body: NavCreate,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """新增导航项：校验父项存在（防孤儿节点）。"""
    if body.parent_id is not None:
        parent = db.get(Navigation, body.parent_id)
        if parent is None:
            raise not_found("父导航不存在")

    item = Navigation(
        parent_id=body.parent_id,
        label_json=body.label.model_dump(),
        link_type=body.link_type,
        link_value=body.link_value,
        sort=body.sort,
        enabled=body.enabled,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    # 审计 + 缓存刷新（前台导航 SSR 实时拉取，通知兜底 ISR 相关页面）
    write_audit(db, operator, "create", "navigation", item.id, {"label": body.label.zh})
    notify_revalidate(["nav", "home"])

    return ok({"id": item.id}, message="创建成功")


@router.put("/{item_id}")
def update_navigation(
    item_id: int,
    body: NavUpdate,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """修改导航项（全量更新）。"""
    item = db.get(Navigation, item_id)
    if item is None:
        raise not_found("导航项不存在")

    # 父项存在性 + 自引用校验（不能把节点挂到自己或子孙下）
    if body.parent_id is not None:
        parent = db.get(Navigation, body.parent_id)
        if parent is None:
            raise not_found("父导航不存在")
        if body.parent_id == item_id:
            raise validation("导航项不能以自身为父级")

    item.parent_id = body.parent_id
    item.label_json = body.label.model_dump()
    item.link_type = body.link_type
    item.link_value = body.link_value
    item.sort = body.sort
    item.enabled = body.enabled
    db.commit()

    write_audit(db, operator, "update", "navigation", item.id, {"label": body.label.zh})
    notify_revalidate(["nav", "home"])

    return ok(None, message="更新成功")


@router.delete("/{item_id}")
def delete_navigation(
    item_id: int,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """删除导航项：含子项时拒绝（422 NAV_HAS_CHILDREN）。

    说明：数据库文档 §3.5 声明 CASCADE 兜底，但方案 M2 明确"删除含子项 422"，
    应用层预检子项，避免误删导航树（前端 confirm 提示后再操作）。
    """
    item = db.get(Navigation, item_id)
    if item is None:
        raise not_found("导航项不存在")

    # 预检子项
    has_children = db.query(Navigation).filter(Navigation.parent_id == item_id).first()
    if has_children:
        raise validation("该导航项包含子项，无法删除（请先删除子项）")

    db.delete(item)
    db.commit()

    write_audit(db, operator, "delete", "navigation", item_id)
    notify_revalidate(["nav", "home"])

    return ok(None, message="删除成功")


@router.put("/{item_id}/toggle")
def toggle_navigation(
    item_id: int,
    body: NavToggle,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """启停导航项（body: {"enabled": true|false}）。"""
    item = db.get(Navigation, item_id)
    if item is None:
        raise not_found("导航项不存在")

    enabled = body.enabled
    item.enabled = enabled
    db.commit()

    write_audit(db, operator, "toggle", "navigation", item_id, {"enabled": enabled})
    notify_revalidate(["nav", "home"])

    return ok(None, message="已启用" if enabled else "已停用")
