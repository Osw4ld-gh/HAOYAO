# ============================================================================
# HAOYAO 后端：前台内容公开接口（故事 / 时间轴 / 资讯 / 联系方式）
# 功能：
#   - GET /story       品牌故事（单行，无记录返回空结构）
#   - GET /timeline    发展历程（年份倒序）
#   - GET /articles    资讯列表（company|industry 过滤 + 分页，仅 published）
#   - GET /articles/{id} 资讯详情（草稿/不存在 → 40400）
#   - GET /contact     联系方式（site_setting.contact 键）
# 依据：方案 §4-M4 / 技术文档 §6.4.5：内容读接口均为 SSG/SSR（不缓存或短缓存）。
# ============================================================================

# mypy: disable-error-code="no-untyped-def"
# 说明：FastAPI 路由返回类型由 OpenAPI 自动处理，故豁免该规则。

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ...core.db import get_db
from ...core.errors import not_found
from ...models import Article, SiteSetting, Story, Timeline
from ...utils.pagination import DEFAULT_PAGE_SIZE_FRONT, MAX_PAGE_SIZE, normalize_page, paginate
from ...utils.response import ok

router = APIRouter(prefix="", tags=["public-content"])


# ============================================================================
# 品牌故事（SSG：关于页 /about/story 数据源）
# ============================================================================

@router.get("/story")
def get_story(db: Session = Depends(get_db)):
    """品牌故事单行读取（无记录返回空结构，页面渲染占位）。"""
    story = db.get(Story, 1)
    if story is None:
        empty = {"title": {"zh": "", "en": ""}, "content": {"zh": "", "en": ""}, "hero_image": ""}
        return ok(empty)
    return ok(
        {
            "title": story.title_json,
            "content": story.content_json,
            "hero_image": story.hero_image or "",
        }
    )


# ============================================================================
# 发展历程（SSG：/about/history 数据源）
# ============================================================================

@router.get("/timeline")
def list_timeline(db: Session = Depends(get_db)):
    """发展历程列表：年份倒序 + sort 升序（数据库文档 §4.9）。"""
    items = db.query(Timeline).order_by(Timeline.year.desc(), Timeline.sort.asc()).all()
    return ok(
        [
            {
                "id": t.id,
                "year": t.year,
                "title": t.title_json,
                "desc": t.desc_json,
                "image_url": t.image_url or "",
            }
            for t in items
        ]
    )


# ============================================================================
# 资讯（SSG/ISR：/news 列表与详情数据源）
# ============================================================================

@router.get("/articles")
def list_articles(
    category: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(DEFAULT_PAGE_SIZE_FRONT, ge=1, le=MAX_PAGE_SIZE),
    db: Session = Depends(get_db),
):
    """资讯列表（前台）：仅 published；category 过滤（company/industry）。

    卡片结构（技术文档 §6.4.5）：id/category/title/summary/cover_url/published_at。
    """
    query = (
        select(Article)
        .where(Article.status == "published")
        .order_by(Article.published_at.desc(), Article.id.desc())
    )
    if category:
        query = query.where(Article.category == category)

    page, page_size = normalize_page(page, page_size, DEFAULT_PAGE_SIZE_FRONT)
    result = paginate(db, query, page, page_size)

    items = [
        {
            "id": a.id,
            "category": a.category,
            "title": a.title_json,
            "summary": a.summary_json,
            "cover_url": a.cover_url or "",
            "published_at": a.published_at,
        }
        for a in result["items"]
    ]
    return ok(
        {
            "total": result["total"],
            "page": result["page"],
            "page_size": result["page_size"],
            "items": items,
        }
    )


@router.get("/articles/{article_id}")
def get_article_detail(article_id: int, db: Session = Depends(get_db)):
    """资讯详情（前台）：草稿/不存在 → 40400（草稿前台不可见）。"""
    article = db.get(Article, article_id)
    if article is None or article.status != "published":
        raise not_found("资讯不存在或未发布")
    return ok(
        {
            "id": article.id,
            "category": article.category,
            "title": article.title_json,
            "summary": article.summary_json,
            "content": article.content_json,
            "cover_url": article.cover_url or "",
            "published_at": article.published_at,
        }
    )


# ============================================================================
# 联系方式（SSG：/about/contact 数据源）
# ============================================================================

@router.get("/contact")
def get_contact(db: Session = Depends(get_db)):
    """联系方式：site_setting.contact 键（数据库文档 §7.1 预留键）。

    返回结构：{"phone": Bilingual, "email": str, "address": Bilingual}。
    """
    setting = db.query(SiteSetting).filter(SiteSetting.key == "contact").first()
    if setting is None or not isinstance(setting.value_json, dict):
        return ok({"phone": {"zh": "", "en": ""}, "email": "", "address": {"zh": "", "en": ""}})
    value = setting.value_json
    return ok(
        {
            "phone": value.get("phone") or {"zh": "", "en": ""},
            "email": value.get("email") or "",
            "address": value.get("address") or {"zh": "", "en": ""},
        }
    )
