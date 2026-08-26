# ============================================================================
# HAOYAO 后端：前台公开接口 —— 产品列表与详情
# 功能：
#   - GET /api/v1/products          产品列表（top_slug/sub_slug/is_new 过滤 + 分页）
#   - GET /api/v1/products/{id}     产品详情（含图片/色号/相关推荐/分类链）
# 依据：《HAOYAO_官网_开发技术文档.md》§6.4.3 / §6.4.4：
#   - 仅返回 status=on（下架前台不可见，详情 40400）
#   - 排序 is_new DESC, sort ASC, id ASC（稳定排序）
#   - 分页默认 12、上限 100；详情 related 取同 sub_id 其他产品 4 个
# ============================================================================

# mypy: disable-error-code="no-untyped-def"
# 说明：FastAPI 路由返回类型由 OpenAPI 自动处理，故豁免该规则。

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ...core.db import get_db
from ...core.errors import not_found
from ...models import Product, SubCategory, TopCategory
from ...utils.pagination import DEFAULT_PAGE_SIZE_FRONT, MAX_PAGE_SIZE, normalize_page, paginate
from ...utils.response import ok

router = APIRouter(prefix="/products", tags=["public-products"])


def _cover_image(product: Product) -> str | None:
    """主图 URL（无主图时取第一张）。"""
    for img in product.images:
        if img.is_cover:
            return img.url
    return product.images[0].url if product.images else None


def _card(product: Product) -> dict:
    """产品卡片结构（技术文档 §6.4.2 产品卡片）。

    增强：额外返回 top_slug（所属顶层分类），供前端生成 /{top}/p/{id} 详情路由。
    """
    top_slug = (
        product.sub_category.top_category.slug
        if product.sub_category and product.sub_category.top_category
        else None
    )
    return {
        "id": product.id,
        "name": product.name_json,
        "ref_code": product.ref_code,
        "price": product.price,
        "is_new": product.is_new,
        "cover_image": _cover_image(product),
        "top_slug": top_slug,
    }


@router.get("")
def list_products(
    top_slug: str | None = None,
    sub_slug: str | None = None,
    is_new: bool | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(DEFAULT_PAGE_SIZE_FRONT, ge=1, le=MAX_PAGE_SIZE),
    db: Session = Depends(get_db),
):
    """产品列表（前台）：仅上架产品，支持顶层/二级分类与新品过滤。

    过滤规则（技术文档 §6.4.3）：
      - top_slug：顶层分类 slug（如 skincare）
      - sub_slug：二级分类 slug（如 serum），与 top_slug 联用
      - is_new：仅新品（首页新品区用）
    """
    query = (
        select(Product)
        .options(
            joinedload(Product.images),
            joinedload(Product.sub_category).joinedload(SubCategory.top_category),
        )
        .where(Product.status == "on")
        .order_by(Product.is_new.desc(), Product.sort.asc(), Product.id.asc())
    )

    if sub_slug:
        # 二级 slug 需先解析 top_slug 上下文（同 slug 可能在不同顶层下）
        if top_slug:
            top = (
                db.query(TopCategory).filter(TopCategory.slug == top_slug).first()
            )
            if top is None:
                # 顶层不存在 → 空结果（不报错，避免暴露结构）
                return ok({"total": 0, "page": page, "page_size": page_size, "items": []})
            sub = (
                db.query(SubCategory)
                .filter(SubCategory.top_id == top.id, SubCategory.slug == sub_slug)
                .first()
            )
            if sub is None:
                return ok({"total": 0, "page": page, "page_size": page_size, "items": []})
            query = query.where(Product.sub_id == sub.id)
        else:
            # 未指定顶层：按二级 slug 全局匹配（如 /serum）
            sub_ids = select(SubCategory.id).where(SubCategory.slug == sub_slug)
            query = query.where(Product.sub_id.in_(sub_ids))
    elif top_slug:
        # 仅顶层过滤：sub_id IN (该顶层下全部二级)
        top = db.query(TopCategory).filter(TopCategory.slug == top_slug).first()
        if top is None:
            return ok({"total": 0, "page": page, "page_size": page_size, "items": []})
        sub_ids = select(SubCategory.id).where(SubCategory.top_id == top.id)
        query = query.where(Product.sub_id.in_(sub_ids))

    if is_new is not None:
        query = query.where(Product.is_new.is_(is_new))

    page, page_size = normalize_page(page, page_size, DEFAULT_PAGE_SIZE_FRONT)
    result = paginate(db, query, page, page_size)

    return ok(
        {
            "total": result["total"],
            "page": result["page"],
            "page_size": result["page_size"],
            "items": [_card(p) for p in result["items"]],
        }
    )


@router.get("/{product_id}")
def get_product_detail(product_id: int, db: Session = Depends(get_db)):
    """产品详情（前台）：下架或不存在 → 40400（PRD §4.3 下架产品 404）。

    返回：基本信息 + desc/ingredients/usage + images + variants
          + sub_category（面包屑）+ related（同分类其他产品 4 个）。
    """
    product = (
        db.query(Product)
        .options(
            joinedload(Product.images),
            joinedload(Product.sub_category).joinedload(SubCategory.top_category),
        )
        .filter(Product.id == product_id)
        .first()
    )
    # 下架产品前台不可见（404，不泄露存在性）
    if product is None or product.status != "on":
        raise not_found("产品不存在或已下架")

    # 相关推荐：同 sub_id 其他上架产品 4 个（排除自身，按 sort）
    related = (
        db.query(Product)
        .options(joinedload(Product.images))
        .filter(
            Product.sub_id == product.sub_id,
            Product.status == "on",
            Product.id != product_id,
        )
        .order_by(Product.sort.asc(), Product.id.asc())
        .limit(4)
        .all()
    )

    return ok(
        {
            "id": product.id,
            "name": product.name_json,
            "ref_code": product.ref_code,
            "price": product.price,
            "is_new": product.is_new,
            "desc": product.desc_json,
            "ingredients": product.ingredients_json,
            "usage": product.usage_json,
            "images": [
                {"url": img.url, "is_cover": img.is_cover}
                for img in sorted(product.images, key=lambda i: i.sort)
            ],
            "variants": product.variants_json,
            "sub_category": {
                "id": product.sub_category.id,
                "slug": product.sub_category.slug,
                "top_slug": product.sub_category.top_category.slug,
                "name": product.sub_category.name_json,
            }
            if product.sub_category
            else None,
            "related": [_card(p) for p in related],
        }
    )
