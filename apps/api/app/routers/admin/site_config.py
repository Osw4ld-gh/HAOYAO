# ============================================================================
# HAOYAO 后端：网站配置路由（banner CRUD + site-config 聚合读写）
# 功能：
#   - GET/POST/PUT/DELETE /admin/banners    首页轮播 CRUD（含停用项管理）
#   - GET/PUT /admin/site-config            网站配置聚合（seo/switches/contact/featured）
# 依据：PRD §5.7 网站配置 / 技术文档 §6.5.4：
#   - banner：link_type 枚举 product/article/url；enabled 控制前台展示
#   - site_setting 固定 4 键（contact/seo/switches/featured_products）
#   - 写操作审计 + revalidate（home / config）
# ============================================================================

# mypy: disable-error-code="no-untyped-def"
# 说明：FastAPI 路由返回类型由 OpenAPI 自动处理，故豁免该规则。

from __future__ import annotations

from typing import Literal, cast

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ...core.db import get_db
from ...core.deps import require_admin
from ...core.errors import not_found
from ...models import Banner, SiteSetting
from ...services.revalidate import notify_revalidate
from ...utils.audit import write_audit
from ...utils.response import ok

router = APIRouter(prefix="", tags=["admin-site-config"])


# ============================================================================
# Banner CRUD
# ============================================================================

class BannerPayload(BaseModel):
    """banner 新增/修改请求体。"""

    image_url: str = Field(..., max_length=512)
    title: dict = Field(default_factory=dict)
    link_type: Literal["product", "article", "url"] = "url"
    link_value: str = Field(default="", max_length=255)
    sort: int = Field(default=0, ge=0)
    enabled: bool = True


def _serialize(banner: Banner) -> dict:
    return {
        "id": banner.id,
        "image_url": banner.image_url,
        "title": banner.title_json,
        "link_type": banner.link_type,
        "link_value": banner.link_value or "",
        "sort": banner.sort,
        "enabled": banner.enabled,
    }


@router.get("/banners")
def list_banners(
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """banner 列表（后台：全部，含停用，按 sort 升序）。"""
    items = db.query(Banner).order_by(Banner.sort, Banner.id).all()
    return ok([_serialize(b) for b in items])


@router.post("/banners", status_code=201)
def create_banner(
    body: BannerPayload,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """新增 banner。"""
    banner = Banner(
        image_url=body.image_url,
        title_json=body.title,
        link_type=body.link_type,
        link_value=body.link_value or None,
        sort=body.sort,
        enabled=body.enabled,
    )
    db.add(banner)
    db.commit()
    db.refresh(banner)

    write_audit(db, operator, "create", "banner", banner.id, {"image_url": body.image_url})
    notify_revalidate(["home"])
    return ok({"id": banner.id}, message="创建成功")


@router.put("/banners/{banner_id}")
def update_banner(
    banner_id: int,
    body: BannerPayload,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """修改 banner。"""
    banner = db.get(Banner, banner_id)
    if banner is None:
        raise not_found("banner 不存在")

    banner.image_url = body.image_url
    banner.title_json = body.title
    banner.link_type = body.link_type
    banner.link_value = body.link_value or None
    banner.sort = body.sort
    banner.enabled = body.enabled
    db.commit()

    write_audit(db, operator, "update", "banner", banner_id, {"image_url": body.image_url})
    notify_revalidate(["home"])
    return ok(None, message="更新成功")


@router.delete("/banners/{banner_id}")
def delete_banner(
    banner_id: int,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """删除 banner。"""
    banner = db.get(Banner, banner_id)
    if banner is None:
        raise not_found("banner 不存在")

    db.delete(banner)
    db.commit()

    write_audit(db, operator, "delete", "banner", banner_id)
    notify_revalidate(["home"])
    return ok(None, message="删除成功")


# ============================================================================
# site-config 聚合读写
# ============================================================================

# 固定 4 键（数据库文档 §4.12）
SITE_KEYS = ("contact", "seo", "switches", "featured_products")


class SiteConfigUpdate(BaseModel):
    """网站配置更新请求体（部分更新，仅提交需要修改的键）。"""

    contact: dict | None = None
    seo: dict | None = None
    switches: dict | None = None
    featured_products: list[int] | None = None


def _load_settings(db: Session) -> dict:
    """读取 site_setting 4 键 → 聚合结构（缺省空结构）。"""
    rows = db.query(SiteSetting).filter(SiteSetting.key.in_(SITE_KEYS)).all()
    data: dict = {k: {} for k in SITE_KEYS}
    for row in rows:
        value = row.value_json
        # featured_products 为有序列表，其余键为 dict（直接透传，避免强制 dict 丢失列表）
        data[row.key] = value if isinstance(value, (dict, list)) else {}
    return data


@router.get("/site-config")
def get_site_config(
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """网站配置聚合读取：contact/seo/switches/featured_products。"""
    return ok(_load_settings(db))


@router.put("/site-config")
def update_site_config(
    body: SiteConfigUpdate,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """网站配置部分更新（仅覆盖提交的键，未提交键保持不变）。

    说明：featured_products 有序列表（首页明星位按此顺序展示）。
    """
    updates: dict[str, dict | list] = {}
    if body.contact is not None:
        updates["contact"] = body.contact
    if body.seo is not None:
        updates["seo"] = body.seo
    if body.switches is not None:
        updates["switches"] = body.switches
    if body.featured_products is not None:
        updates["featured_products"] = body.featured_products

    if updates:
        for key, value in updates.items():
            setting = db.query(SiteSetting).filter(SiteSetting.key == key).first()
            if setting is None:
                setting = SiteSetting(key=key)
                db.add(setting)
            # featured_products 为列表、其余为 dict；JSON 列统一按 dict 存储（mypy cast）
            setting.value_json = cast(dict, value)
        db.commit()

    write_audit(db, operator, "update", "site_config", None, {"keys": list(updates.keys())})
    notify_revalidate(["home", "config"])
    return ok(None, message="保存成功")
