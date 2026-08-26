# ============================================================================
# HAOYAO 后端：前台公开接口 —— 首页聚合
# 功能：GET /api/v1/home —— banners + new_products + featured_products + latest_articles。
# 依据：《HAOYAO_官网_开发技术文档.md》§6.4.2（ISR 60s 消费）：
#   - banners：banner 表 enabled=1 按 sort（≤3 条轮播）
#   - new_products：is_new=1 且上架，≤8
#   - featured_products：site_setting.featured_products 有序 id 列表 → 产品卡（≤3）
#   - latest_articles：已发布资讯前 3（M4 内容上线后数据驱动）
# ============================================================================

# mypy: disable-error-code="no-untyped-def"
# 说明：FastAPI 路由返回类型由 OpenAPI 自动处理，故豁免该规则。

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from ...core.db import get_db
from ...models import Article, Banner, Product, SiteSetting
from ...utils.response import ok
from .products import _card

router = APIRouter(prefix="/home", tags=["public-home"])


@router.get("")
def get_home(db: Session = Depends(get_db)):
    """首页聚合数据：四组数据一次返回，页面 ISR 60s 缓存。"""
    # 1) 轮播 banners（启用，按 sort）
    banners = (
        db.query(Banner)
        .filter(Banner.enabled.is_(True))
        .order_by(Banner.sort, Banner.id)
        .all()
    )
    banner_list = [
        {
            "id": b.id,
            "image_url": b.image_url,
            "title": b.title_json,
            "link_type": b.link_type,
            "link_value": b.link_value,
        }
        for b in banners
    ]

    # 2) 新品区（≤8，is_new 且上架，稳定排序）
    new_products = (
        db.query(Product)
        .options(joinedload(Product.images))
        .filter(Product.status == "on", Product.is_new.is_(True))
        .order_by(Product.sort.asc(), Product.id.asc())
        .limit(8)
        .all()
    )

    # 3) 明星推荐位（site_setting.featured_products 有序 id 列表 → 按序取卡片）
    featured_ids: list[int] = []
    setting = db.query(SiteSetting).filter(SiteSetting.key == "featured_products").first()
    if setting and isinstance(setting.value_json, list):
        featured_ids = [i for i in setting.value_json if isinstance(i, int)]

    featured_products: list[dict] = []
    if featured_ids:
        products = (
            db.query(Product)
            .options(joinedload(Product.images))
            .filter(Product.status == "on", Product.id.in_(featured_ids))
            .all()
        )
        by_id = {p.id: p for p in products}
        # 按 featured_ids 原顺序输出（数据库文档 §7.2 有序列表）
        featured_products = [
            _card(by_id[pid]) for pid in featured_ids if pid in by_id
        ]

    # 4) 最新资讯（已发布前 3；M4 内容上线后数据驱动）
    latest_articles = (
        db.query(Article)
        .filter(Article.status == "published")
        .order_by(Article.published_at.desc(), Article.id.desc())
        .limit(3)
        .all()
    )
    article_list = [
        {
            "id": a.id,
            "category": a.category,
            "title": a.title_json,
            "summary": a.summary_json,
            "cover_url": a.cover_url,
            "published_at": a.published_at,
        }
        for a in latest_articles
    ]

    return ok(
        {
            "banners": banner_list,
            "new_products": [_card(p) for p in new_products],
            "featured_products": featured_products,
            "latest_articles": article_list,
        }
    )
