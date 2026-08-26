# ============================================================================
# HAOYAO 后端：翻译完整率统计接口（M5）
# 功能：GET /admin/translation-stats —— 产品/资讯的翻译完整度统计。
# 依据：方案 §4-M5（翻译完整率统计接口，translation_complete）+ 技术文档 §6.5.1：
#   - 产品完整 = name/desc/ingredients/usage 四组双语 zh+en 均非空
#   - 资讯完整 = title/summary/content 三组双语 zh+en 均非空
#   - 供后台仪表盘（M6）与上线门槛（待翻译计数归零）消费
# ============================================================================

# mypy: disable-error-code="no-untyped-def"
# 说明：FastAPI 路由返回类型由 OpenAPI 自动处理，故豁免该规则。

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...core.db import get_db
from ...core.deps import require_admin
from ...models import Article, AuditLog, Banner, MediaAsset, Product, SubCategory, TopCategory
from ...utils.response import ok

router = APIRouter(prefix="/translation-stats", tags=["admin-stats"])

# 仪表盘统计独立前缀（/admin/dashboard/stats）
dashboard_router = APIRouter(prefix="/dashboard", tags=["admin-dashboard"])


def _bilingual_complete(value: dict | None) -> bool:
    """双语字段完整性：zh 与 en 均非空。"""
    return bool(value and value.get("zh") and value.get("en"))


@router.get("")
def translation_stats(
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """翻译完整率统计：产品与资讯的 total / complete / incomplete。"""
    # 产品：四组双语字段（name/desc/ingredients/usage）
    products = db.query(Product).all()
    product_complete = sum(
        1
        for p in products
        if all(
            _bilingual_complete(field)
            for field in (p.name_json, p.desc_json, p.ingredients_json, p.usage_json)
        )
    )

    # 资讯：三组双语字段（title/summary/content）
    articles = db.query(Article).all()
    article_complete = sum(
        1
        for a in articles
        if all(
            _bilingual_complete(field)
            for field in (a.title_json, a.summary_json, a.content_json)
        )
    )

    return ok(
        {
            "products": {
                "total": len(products),
                "complete": product_complete,
                "incomplete": len(products) - product_complete,
            },
            "articles": {
                "total": len(articles),
                "complete": article_complete,
                "incomplete": len(articles) - article_complete,
            },
        }
    )


# ============================================================================
# 仪表盘统计（M6）：6 卡片 + 最近操作审计
# ============================================================================

@dashboard_router.get("/stats")
def dashboard_stats(
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """仪表盘统计：产品/分类/资讯/轮播/媒体/待翻译 6 组 + 最近操作审计 8 条。

    依据：PRD §5.2 仪表盘 / 数据库文档 §4.14（审计只追加）。
    """
    from ...models import Article

    # 产品总数
    product_total = db.query(Product).count()
    # 分类：顶层 / 二级
    top_total = db.query(TopCategory).count()
    sub_total = db.query(SubCategory).count()
    # 资讯：总数 / 已发布 / 草稿
    article_total = db.query(Article).count()
    article_published = db.query(Article).filter(Article.status == "published").count()
    # 轮播（启用）
    banner_total = db.query(Banner).filter(Banner.enabled.is_(True)).count()
    # 媒体：总数 / 图片 / 视频
    media_total = db.query(MediaAsset).count()
    media_images = db.query(MediaAsset).filter(MediaAsset.type == "image").count()
    media_videos = db.query(MediaAsset).filter(MediaAsset.type == "video").count()
    # 待翻译计数（复用 M5 统计逻辑）
    products = db.query(Product).all()
    product_incomplete = sum(
        1
        for p in products
        if not all(
            _bilingual_complete(f)
            for f in (p.name_json, p.desc_json, p.ingredients_json, p.usage_json)
        )
    )
    articles = db.query(Article).all()
    article_incomplete = sum(
        1
        for a in articles
        if not all(
            _bilingual_complete(f)
            for f in (a.title_json, a.summary_json, a.content_json)
        )
    )
    # 最近操作审计（8 条，时间倒序）
    audits = (
        db.query(AuditLog)
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .limit(8)
        .all()
    )
    recent_audits = [
        {
            "id": a.id,
            "operator": a.operator,
            "action": a.action,
            "target_type": a.target_type,
            "target_id": a.target_id,
            "detail": a.detail_json,
            "created_at": a.created_at,
        }
        for a in audits
    ]

    return ok(
        {
            "products": product_total,
            "categories": {"top": top_total, "sub": sub_total},
            "articles": {"total": article_total, "published": article_published},
            "banners": banner_total,
            "media": {"total": media_total, "images": media_images, "videos": media_videos},
            "translation": {
                "products_incomplete": product_incomplete,
                "articles_incomplete": article_incomplete,
            },
            "recent_audits": recent_audits,
        }
    )
