# ============================================================================
# HAOYAO 后端：产品管理路由（CRUD + 批量上下架）
# 功能：
#   - GET    /admin/products            列表（分页 + 过滤 + translation_complete）
#   - POST   /admin/products            新增（校验：name.zh 必填/ref_code 唯一/images 单主图）
#   - GET    /admin/products/{id}       详情（含图片/色号/所属分类）
#   - PUT    /admin/products/{id}       修改（全量更新）
#   - DELETE /admin/products/{id}       删除（级联删图片 + 清理 featured_products 残留）
#   - POST   /admin/products/batch-status 批量上/下架（审计 batch_status）
# 依据：《HAOYAO_官网_开发技术文档.md》§6.5.1 / 数据库文档 §4.5/§4.6/§7.2：
#   - 请求体 name/desc/ingredients/usage/variants/images（路由层映射 *_json 存储）
#   - 列表排序 ORDER BY is_new DESC, sort ASC, id ASC（新品置顶稳定排序）
#   - 删除产品时同步从 site_setting.featured_products 移除该 id（残留清理）
# ============================================================================

# mypy: disable-error-code="no-untyped-def"
# 说明：FastAPI 路由返回类型由 OpenAPI 自动处理，标注 union 反而污染 schema，故豁免该规则。

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from ...core.db import get_db
from ...core.deps import require_admin
from ...core.errors import conflict, not_found
from ...models import Product, ProductImage, SiteSetting, SubCategory
from ...schemas.product import (
    BatchStatusRequest,
    ProductCreate,
    ProductImageItem,
    ProductUpdate,
)
from ...services.revalidate import notify_revalidate
from ...utils.audit import write_audit
from ...utils.pagination import (
    DEFAULT_PAGE_SIZE_ADMIN,
    MAX_PAGE_SIZE,
    normalize_page,
    paginate,
)
from ...utils.response import ok

router = APIRouter(prefix="/products", tags=["admin-products"])

# 列表过滤字段（技术文档 §6.5.1）：top_id / sub_id / status / keyword
_LIST_FILTERS = ("top_id", "sub_id", "status", "keyword")


def _cover_image(images: list[ProductImage]) -> str | None:
    """取主图 URL（is_cover=1），无主图时取第一张。"""
    for img in images:
        if img.is_cover:
            return img.url
    return images[0].url if images else None


def _translation_complete(product: Product) -> bool:
    """双语完整性：name/desc/ingredients/usage 四个双语字段 zh+en 均非空。

    依据：技术文档 §6.5.1 —— 四组双语字段全非空即完整。
    """
    fields = (product.name_json, product.desc_json, product.ingredients_json, product.usage_json)
    for field in fields:
        if not field:
            return False
        if not field.get("zh") or not field.get("en"):
            return False
    return True


def _serialize_card(product: Product) -> dict:
    """产品卡片序列化（列表用）：含 translation_complete / 封面 / 顶层分类名。"""
    images = product.images
    return {
        "id": product.id,
        "sub_id": product.sub_id,
        "name": product.name_json,
        "ref_code": product.ref_code,
        "price": product.price,
        "is_new": product.is_new,
        "status": product.status,
        "sort": product.sort,
        "translation_complete": _translation_complete(product),
        "cover_image": _cover_image(images),
        # 所属顶层信息（列表过滤与展示用；sub_category 关系在 query 中 joinedload）
        "top_id": product.sub_category.top_id if product.sub_category else None,
        "top_name": (
            product.sub_category.top_category.slug
            if product.sub_category and product.sub_category.top_category
            else None
        ),
        "created_at": product.created_at,
        "updated_at": product.updated_at,
    }


@router.get("")
def list_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(DEFAULT_PAGE_SIZE_ADMIN, ge=1, le=MAX_PAGE_SIZE),
    top_id: int | None = None,
    sub_id: int | None = None,
    status: str | None = None,
    keyword: str | None = None,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """产品列表（后台）：分页 + 过滤 + 模糊搜索。

    过滤：
      - top_id：按顶层分类（需 join sub_category 过滤）
      - sub_id：按二级分类
      - status：on / off
      - keyword：模糊匹配 name_json.zh / ref_code（SQLite JSON1）
    排序：is_new DESC, sort ASC, id ASC（数据库文档 D5 稳定排序）。
    """
    # 基础查询：预加载 images 与 sub_category/top_category 链，避免 N+1
    query = (
        select(Product)
        .options(
            joinedload(Product.images),
            joinedload(Product.sub_category).joinedload(SubCategory.top_category),
        )
        .order_by(Product.is_new.desc(), Product.sort.asc(), Product.id.asc())
    )

    if sub_id is not None:
        query = query.where(Product.sub_id == sub_id)
    elif top_id is not None:
        # 顶层过滤：sub_id IN (该顶层下全部二级 id)
        sub_ids = select(SubCategory.id).where(SubCategory.top_id == top_id)
        query = query.where(Product.sub_id.in_(sub_ids))
    if status is not None:
        query = query.where(Product.status == status)
    if keyword:
        # JSON1 模糊匹配中文名 / 参考编号（数据库文档 §6 后台产品模糊搜索）
        # 说明：SQLite 方言使用 json_extract 提取 name_json.zh（PostgreSQL 迁移时
        # 可改用 JSONB 路径表达式，此处与分页工具一样保持方言差异在查询层）
        like = f"%{keyword}%"
        query = query.where(
            or_(
                Product.ref_code.like(like),
                func.json_extract(Product.name_json, "$.zh").like(like),
            )
        )

    # 分页（utils.pagination：count 子查询 + offset/limit，返回 ORM 对象）
    page, page_size = normalize_page(page, page_size, DEFAULT_PAGE_SIZE_ADMIN)
    result = paginate(db, query, page, page_size)

    return ok(
        {
            "total": result["total"],
            "page": result["page"],
            "page_size": result["page_size"],
            "items": [_serialize_card(p) for p in result["items"]],
        }
    )


def _apply_product_fields(product: Product, body: ProductCreate | ProductUpdate) -> None:
    """将请求体（name/desc/... 无 _json 后缀）映射到 ORM 字段（*_json）。"""
    product.sub_id = body.sub_id
    product.name_json = body.name.model_dump()
    product.ref_code = body.ref_code
    product.price = body.price
    product.desc_json = body.desc.model_dump()
    product.ingredients_json = body.ingredients.model_dump()
    product.usage_json = body.usage.model_dump()
    product.variants_json = [v.model_dump() for v in body.variants]
    product.is_new = body.is_new
    product.status = body.status
    product.sort = body.sort


def _replace_images(db: Session, product: Product, images: list[ProductImageItem]) -> None:
    """全量替换产品图片（先删旧记录再写入新列表）。

    说明：product_image 无 updated_at，全量替换语义与"修改表单提交完整图片列表"一致。
    """
    # 删除旧图片（ORM 级联：product.images cascade="all, delete-orphan"）
    product.images.clear()
    for idx, img in enumerate(images):
        product.images.append(
            ProductImage(url=img.url, is_cover=img.is_cover, sort=idx)
        )


@router.post("", status_code=201)
def create_product(
    body: ProductCreate,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """新增产品。"""
    # 二级分类存在性校验
    sub = db.get(SubCategory, body.sub_id)
    if sub is None:
        raise not_found("所属二级分类不存在")

    # ref_code 唯一（数据库文档 §10.2 增强：DDL UNIQUE + 接口 409 双保险）
    exists = db.query(Product).filter(Product.ref_code == body.ref_code).first()
    if exists:
        raise conflict(f"参考编号已存在: {body.ref_code}")

    product = Product()
    _apply_product_fields(product, body)
    db.add(product)
    db.flush()  # 先获得 product.id，供图片外键引用
    _replace_images(db, product, body.images)
    db.commit()
    db.refresh(product)

    write_audit(db, operator, "create", "product", product.id, {"ref_code": body.ref_code})
    notify_revalidate(["products", "home"])

    return ok({"id": product.id}, message="创建成功")


@router.get("/{product_id}")
def get_product(
    product_id: int,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """产品详情（后台）：含图片、色号、所属分类完整信息。"""
    product = (
        db.query(Product)
        .options(
            joinedload(Product.images),
            joinedload(Product.sub_category).joinedload(SubCategory.top_category),
        )
        .filter(Product.id == product_id)
        .first()
    )
    if product is None:
        raise not_found("产品不存在")

    return ok(
        {
            "id": product.id,
            "sub_id": product.sub_id,
            "name": product.name_json,
            "ref_code": product.ref_code,
            "price": product.price,
            "desc": product.desc_json,
            "ingredients": product.ingredients_json,
            "usage": product.usage_json,
            "variants": product.variants_json,
            "is_new": product.is_new,
            "status": product.status,
            "sort": product.sort,
            "images": [
                {"url": img.url, "is_cover": img.is_cover, "sort": img.sort}
                for img in product.images
            ],
            "sub_category": {
                "id": product.sub_category.id,
                "top_id": product.sub_category.top_id,
                "slug": product.sub_category.slug,
                "name": product.sub_category.name_json,
            } if product.sub_category else None,
            "translation_complete": _translation_complete(product),
            "created_at": product.created_at,
            "updated_at": product.updated_at,
        }
    )


@router.put("/{product_id}")
def update_product(
    product_id: int,
    body: ProductUpdate,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """修改产品（全量更新，含图片列表替换）。"""
    product = db.get(Product, product_id)
    if product is None:
        raise not_found("产品不存在")

    sub = db.get(SubCategory, body.sub_id)
    if sub is None:
        raise not_found("所属二级分类不存在")

    # ref_code 唯一（排除自身）
    exists = (
        db.query(Product)
        .filter(Product.ref_code == body.ref_code, Product.id != product_id)
        .first()
    )
    if exists:
        raise conflict(f"参考编号已存在: {body.ref_code}")

    _apply_product_fields(product, body)
    _replace_images(db, product, body.images)
    db.commit()

    write_audit(db, operator, "update", "product", product_id, {"ref_code": body.ref_code})
    notify_revalidate(["products", "home"])

    return ok(None, message="更新成功")


@router.delete("/{product_id}")
def delete_product(
    product_id: int,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """删除产品：级联删除图片记录；同步清理 featured_products 残留。

    依据：数据库文档 §7.2 —— 删除产品时同步从 site_setting.featured_products
    移除该 id（V1.1 补强）。
    """
    product = db.get(Product, product_id)
    if product is None:
        raise not_found("产品不存在")

    # 清理明星产品推荐位残留
    setting = db.query(SiteSetting).filter(SiteSetting.key == "featured_products").first()
    if setting:
        # 显式类型标注：value_json 为 dict|list union，此处仅接受 list 形态
        ids: list[int] = setting.value_json if isinstance(setting.value_json, list) else []
        if product_id in ids:
            ids = [i for i in ids if i != product_id]
            # JSON 字段动态类型（dict|list），此处赋值 list 形态；mypy 忽略类型冲突
            setting.value_json = ids  # type: ignore[assignment]

    db.delete(product)  # 级联删除 product_image
    db.commit()

    write_audit(db, operator, "delete", "product", product_id)
    notify_revalidate(["products", "home"])

    return ok(None, message="删除成功")


@router.post("/batch-status")
def batch_status(
    body: BatchStatusRequest,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """批量上/下架产品。

    审计：action=batch_status，target_id 置空，detail_json 记录 target_ids 列表
    （数据库文档 §4.14 批量操作约定）。
    """
    products = db.query(Product).filter(Product.id.in_(body.ids)).all()
    updated = 0
    for product in products:
        if product.status != body.status:
            product.status = body.status
            updated += 1
    db.commit()

    # 审计：批量操作 target_id 置空、detail 记录 id 列表
    write_audit(
        db,
        operator,
        "batch_status",
        "product",
        detail={"changes": [f"status → {body.status}"], "target_ids": body.ids},
    )
    notify_revalidate(["products", "home"])

    action_text = "上架" if body.status == "on" else "下架"
    return ok({"updated": updated}, message=f"成功{action_text} {updated} 个产品")
