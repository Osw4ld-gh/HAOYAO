# ============================================================================
# HAOYAO 后端：分类体系路由（顶层/二级分类 CRUD）
# 功能：
#   - GET/POST/PUT/DELETE /admin/top-categories[/{id}]     顶层分类
#   - GET/POST/PUT/DELETE /admin/sub-categories[/{id}]     二级分类
# 依据：《HAOYAO_官网_开发技术文档.md》§6.1 / 数据库文档 §4.3/§4.4：
#   - slug 冲突 → 40900（顶层全局唯一；二级同 top_id 下唯一）
#   - 删除含产品二级分类 → 42200 SUBCAT_HAS_PRODUCTS（应用层预检）
#   - 删除顶层：其下无产品时级联删除二级（DB CASCADE）；有产品 → 422 拒绝
#   - 写操作均写审计 + 通知 revalidate（products/nav）
# ============================================================================

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...core.db import get_db
from ...core.deps import require_admin
from ...core.errors import conflict, not_found, validation
from ...models import Product, SubCategory, TopCategory
from ...schemas.category import (
    SubCategoryCreate,
    SubCategoryUpdate,
    TopCategoryCreate,
    TopCategoryUpdate,
)
from ...services.revalidate import notify_revalidate
from ...utils.audit import write_audit
from ...utils.response import ok

router = APIRouter(prefix="", tags=["admin-categories"])


# ============================================================================
# 顶层分类
# ============================================================================

@router.get("/top-categories")
def list_top_categories(
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """顶层分类列表（含二级子集，前端分类管理/产品表单下拉复用）。"""
    tops = db.query(TopCategory).order_by(TopCategory.sort, TopCategory.id).all()
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
                "enabled": top.enabled,
                "sub_categories": [
                    {
                        "id": s.id,
                        "top_id": s.top_id,
                        "slug": s.slug,
                        "name": s.name_json,
                        "sort": s.sort,
                    }
                    for s in subs
                ],
            }
        )
    return ok(data)


@router.post("/top-categories", status_code=201)
def create_top_category(
    body: TopCategoryCreate,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """新增顶层分类：slug 全局唯一（冲突 → 40900）。"""
    exists = db.query(TopCategory).filter(TopCategory.slug == body.slug).first()
    if exists:
        raise conflict(f"slug 已存在: {body.slug}")

    item = TopCategory(slug=body.slug, sort=body.sort, enabled=body.enabled)
    db.add(item)
    db.commit()
    db.refresh(item)

    write_audit(db, operator, "create", "top_category", item.id, {"slug": body.slug})
    notify_revalidate(["products", "nav"])

    return ok({"id": item.id}, message="创建成功")


@router.put("/top-categories/{item_id}")
def update_top_category(
    item_id: int,
    body: TopCategoryUpdate,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """修改顶层分类：slug 冲突校验（排除自身）。"""
    item = db.get(TopCategory, item_id)
    if item is None:
        raise not_found("顶层分类不存在")

    exists = (
        db.query(TopCategory)
        .filter(TopCategory.slug == body.slug, TopCategory.id != item_id)
        .first()
    )
    if exists:
        raise conflict(f"slug 已存在: {body.slug}")

    item.slug = body.slug
    item.sort = body.sort
    item.enabled = body.enabled
    db.commit()

    write_audit(db, operator, "update", "top_category", item_id, {"slug": body.slug})
    notify_revalidate(["products", "nav"])

    return ok(None, message="更新成功")


@router.delete("/top-categories/{item_id}")
def delete_top_category(
    item_id: int,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """删除顶层分类：其下存在产品时拒绝（422），否则级联删除二级。

    说明：sub_category → product 无级联（RESTRICT），若二级下有产品，
    DB 会因外键约束阻止删除；此处应用层预检返回更友好的 422 提示。
    """
    item = db.get(TopCategory, item_id)
    if item is None:
        raise not_found("顶层分类不存在")

    # 预检：该顶层下任一二级分类是否含产品
    sub_ids = [s.id for s in item.sub_categories]
    if sub_ids:
        has_product = db.query(Product).filter(Product.sub_id.in_(sub_ids)).first()
        if has_product:
            raise validation("该分类下存在产品，无法删除")

    # 无产品：删除顶层（DB ON DELETE CASCADE 连带删除二级分类）
    db.delete(item)
    db.commit()

    write_audit(db, operator, "delete", "top_category", item_id)
    notify_revalidate(["products", "nav"])

    return ok(None, message="删除成功")


# ============================================================================
# 二级分类
# ============================================================================

# mypy: disable-error-code="no-untyped-def"
# 说明：FastAPI 路由返回类型由 OpenAPI 自动处理，标注 union 反而污染 schema，故豁免该规则。

@router.get("/sub-categories")
def list_sub_categories(
    top_id: int | None = None,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """二级分类列表（可按 top_id 过滤，默认全量）。"""
    query = db.query(SubCategory)
    if top_id is not None:
        query = query.filter(SubCategory.top_id == top_id)
    items = query.order_by(SubCategory.top_id, SubCategory.sort, SubCategory.id).all()
    return ok(
        [
            {
                "id": s.id,
                "top_id": s.top_id,
                "slug": s.slug,
                "name": s.name_json,
                "sort": s.sort,
            }
            for s in items
        ]
    )


@router.post("/sub-categories", status_code=201)
def create_sub_category(
    body: SubCategoryCreate,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """新增二级分类：父顶层必须存在；同 top_id 下 slug 唯一（冲突 → 40900）。"""
    top = db.get(TopCategory, body.top_id)
    if top is None:
        raise not_found("父顶层分类不存在")

    exists = (
        db.query(SubCategory)
        .filter(SubCategory.top_id == body.top_id, SubCategory.slug == body.slug)
        .first()
    )
    if exists:
        raise conflict(f"该分类下 slug 已存在: {body.slug}")

    item = SubCategory(
        top_id=body.top_id,
        slug=body.slug,
        name_json=body.name.model_dump(),
        sort=body.sort,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    write_audit(db, operator, "create", "sub_category", item.id, {"slug": body.slug})
    notify_revalidate(["products", "nav"])

    return ok({"id": item.id}, message="创建成功")


@router.put("/sub-categories/{item_id}")
def update_sub_category(
    item_id: int,
    body: SubCategoryUpdate,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """修改二级分类：slug 冲突校验（同 top_id 下排除自身）。"""
    item = db.get(SubCategory, item_id)
    if item is None:
        raise not_found("二级分类不存在")

    top = db.get(TopCategory, body.top_id)
    if top is None:
        raise not_found("父顶层分类不存在")

    exists = (
        db.query(SubCategory)
        .filter(
            SubCategory.top_id == body.top_id,
            SubCategory.slug == body.slug,
            SubCategory.id != item_id,
        )
        .first()
    )
    if exists:
        raise conflict(f"该分类下 slug 已存在: {body.slug}")

    item.top_id = body.top_id
    item.slug = body.slug
    item.name_json = body.name.model_dump()
    item.sort = body.sort
    db.commit()

    write_audit(db, operator, "update", "sub_category", item_id, {"slug": body.slug})
    notify_revalidate(["products", "nav"])

    return ok(None, message="更新成功")


@router.delete("/sub-categories/{item_id}")
def delete_sub_category(
    item_id: int,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """删除二级分类：含产品时拒绝（422 SUBCAT_HAS_PRODUCTS）。

    依据：数据库文档 §4.4 业务规则——二级分类删除前若含产品，应用层拒绝。
    """
    item = db.get(SubCategory, item_id)
    if item is None:
        raise not_found("二级分类不存在")

    # 预检产品
    has_product = db.query(Product).filter(Product.sub_id == item_id).first()
    if has_product:
        raise validation("该分类下存在产品，无法删除")

    db.delete(item)
    db.commit()

    write_audit(db, operator, "delete", "sub_category", item_id)
    notify_revalidate(["products", "nav"])

    return ok(None, message="删除成功")
