# ============================================================================
# HAOYAO 后端：后台内容管理路由（故事 / 时间轴 / 资讯）
# 功能：
#   - GET/PUT /admin/story            品牌故事（单行 UPSERT，id=1）
#   - GET/POST/PUT/DELETE /admin/timeline[/{id}]   发展历程时间轴 CRUD
#   - GET/POST/PUT/DELETE /admin/articles[/{id}]   资讯 CRUD（草稿/发布）
#   - PUT /admin/articles/{id}/publish             发布（写 published_at）
# 依据：方案 §4-M4 / 技术文档 §6.1 / 数据库文档 §4.7-§4.9：
#   - 草稿-发布状态机：published_at 发布时写入，草稿为空（应用层保证）
#   - 所有写操作写审计（create/update/delete/publish）+ revalidate
# ============================================================================

# mypy: disable-error-code="no-untyped-def"
# 说明：FastAPI 路由返回类型由 OpenAPI 自动处理，故豁免该规则。

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ...core.db import get_db
from ...core.deps import require_admin
from ...core.errors import not_found
from ...models import Article, Story, Timeline
from ...models.base import utc_now
from ...schemas.content import (
    ArticleCreate,
    ArticleUpdate,
    StoryPayload,
    TimelineCreate,
    TimelineUpdate,
)
from ...services.revalidate import notify_revalidate
from ...utils.audit import write_audit
from ...utils.pagination import DEFAULT_PAGE_SIZE_ADMIN, MAX_PAGE_SIZE, normalize_page, paginate
from ...utils.response import ok

router = APIRouter(prefix="", tags=["admin-content"])


# ============================================================================
# 品牌故事（单行 UPSERT）
# ============================================================================

@router.get("/story")
def get_story(
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """读取品牌故事（无记录时返回空结构供编辑）。"""
    story = db.get(Story, 1)
    if story is None:
        return ok(
            {
                "id": 1,
                "title": {"zh": "", "en": ""},
                "content": {"zh": "", "en": ""},
                "hero_image": "",
            }
        )
    return ok(
        {
            "id": story.id,
            "title": story.title_json,
            "content": story.content_json,
            "hero_image": story.hero_image or "",
        }
    )


@router.put("/story")
def save_story(
    body: StoryPayload,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """保存品牌故事（UPSERT 固定行 id=1；数据库文档 §4.8 单行约束）。"""
    story = db.get(Story, 1)
    if story is None:
        story = Story(id=1)
        db.add(story)
    story.title_json = body.title.model_dump()
    story.content_json = body.content.model_dump()
    story.hero_image = body.hero_image or None
    db.commit()

    write_audit(db, operator, "update", "story", 1, {"title": body.title.zh})
    notify_revalidate(["about", "home"])

    return ok(None, message="保存成功")


# ============================================================================
# 发展历程时间轴 CRUD
# ============================================================================

@router.get("/timeline")
def list_timeline(
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """时间轴列表（年份倒序，前台展示顺序）。"""
    items = db.query(Timeline).order_by(Timeline.year.desc(), Timeline.sort.asc()).all()
    return ok(
        [
            {
                "id": t.id,
                "year": t.year,
                "title": t.title_json,
                "desc": t.desc_json,
                "image_url": t.image_url or "",
                "sort": t.sort,
            }
            for t in items
        ]
    )


@router.post("/timeline", status_code=201)
def create_timeline(
    body: TimelineCreate,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """新增时间轴条目。"""
    item = Timeline(
        year=body.year,
        title_json=body.title.model_dump(),
        desc_json=body.desc.model_dump(),
        image_url=body.image_url or None,
        sort=body.sort,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    write_audit(db, operator, "create", "timeline", item.id, {"year": body.year})
    notify_revalidate(["about"])

    return ok({"id": item.id}, message="创建成功")


@router.put("/timeline/{item_id}")
def update_timeline(
    item_id: int,
    body: TimelineUpdate,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """修改时间轴条目（全量更新）。"""
    item = db.get(Timeline, item_id)
    if item is None:
        raise not_found("时间轴条目不存在")

    item.year = body.year
    item.title_json = body.title.model_dump()
    item.desc_json = body.desc.model_dump()
    item.image_url = body.image_url or None
    item.sort = body.sort
    db.commit()

    write_audit(db, operator, "update", "timeline", item_id, {"year": body.year})
    notify_revalidate(["about"])

    return ok(None, message="更新成功")


@router.delete("/timeline/{item_id}")
def delete_timeline(
    item_id: int,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """删除时间轴条目。"""
    item = db.get(Timeline, item_id)
    if item is None:
        raise not_found("时间轴条目不存在")

    db.delete(item)
    db.commit()

    write_audit(db, operator, "delete", "timeline", item_id)
    notify_revalidate(["about"])

    return ok(None, message="删除成功")


# ============================================================================
# 资讯 CRUD（草稿-发布状态机）
# ============================================================================

def _translation_complete(article: Article) -> bool:
    """资讯双语完整性：title/summary/content 三个双语字段 zh+en 均非空。"""
    for field in (article.title_json, article.summary_json, article.content_json):
        if not field or not field.get("zh") or not field.get("en"):
            return False
    return True


def _serialize(article: Article, with_content: bool = True) -> dict:
    """资讯序列化（后台列表/详情通用）。"""
    data = {
        "id": article.id,
        "category": article.category,
        "title": article.title_json,
        "summary": article.summary_json,
        "cover_url": article.cover_url or "",
        "status": article.status,
        "published_at": article.published_at,
        "translation_complete": _translation_complete(article),
        "created_at": article.created_at,
        "updated_at": article.updated_at,
    }
    if with_content:
        data["content"] = article.content_json
    return data


@router.get("/articles")
def list_articles(
    category: str | None = None,
    status: str | None = None,
    keyword: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(DEFAULT_PAGE_SIZE_ADMIN, ge=1, le=MAX_PAGE_SIZE),
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """资讯列表（后台）：分类/状态/关键词过滤 + 分页（不含正文，减小负载）。"""
    query = (
        select(Article)
        .order_by(Article.created_at.desc(), Article.id.desc())
    )
    if category:
        query = query.where(Article.category == category)
    if status:
        query = query.where(Article.status == status)
    if keyword:
        # JSON1 模糊匹配中文标题（数据库文档 §6 后台资讯模糊搜索）
        like = f"%{keyword}%"
        query = query.where(func.json_extract(Article.title_json, "$.zh").like(like))

    page, page_size = normalize_page(page, page_size, DEFAULT_PAGE_SIZE_ADMIN)
    result = paginate(db, query, page, page_size)
    return ok(
        {
            "total": result["total"],
            "page": result["page"],
            "page_size": result["page_size"],
            "items": [_serialize(a, with_content=False) for a in result["items"]],
        }
    )


@router.post("/articles", status_code=201)
def create_article(
    body: ArticleCreate,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """新增资讯（默认草稿，published_at 留空）。"""
    article = Article(
        category=body.category,
        title_json=body.title.model_dump(),
        summary_json=body.summary.model_dump(),
        content_json=body.content.model_dump(),
        cover_url=body.cover_url or None,
        status="draft",
    )
    db.add(article)
    db.commit()
    db.refresh(article)

    write_audit(db, operator, "create", "article", article.id, {"title": body.title.zh})
    # 草稿不触发前台缓存刷新（前台仅可见 published）
    return ok({"id": article.id}, message="创建成功")


@router.get("/articles/{article_id}")
def get_article(
    article_id: int,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """资讯详情（后台，含正文）。"""
    article = db.get(Article, article_id)
    if article is None:
        raise not_found("资讯不存在")
    return ok(_serialize(article))


@router.put("/articles/{article_id}")
def update_article(
    article_id: int,
    body: ArticleUpdate,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """修改资讯（全量更新；已发布文章修改后保持 published 状态）。"""
    article = db.get(Article, article_id)
    if article is None:
        raise not_found("资讯不存在")

    article.category = body.category
    article.title_json = body.title.model_dump()
    article.summary_json = body.summary.model_dump()
    article.content_json = body.content.model_dump()
    article.cover_url = body.cover_url or None
    db.commit()

    write_audit(db, operator, "update", "article", article_id, {"title": body.title.zh})
    # 已发布文章修改后需刷新前台缓存
    if article.status == "published":
        notify_revalidate(["articles", "home"])

    return ok(None, message="更新成功")


@router.delete("/articles/{article_id}")
def delete_article(
    article_id: int,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """删除资讯（已发布的同步刷新前台缓存）。"""
    article = db.get(Article, article_id)
    if article is None:
        raise not_found("资讯不存在")

    was_published = article.status == "published"
    db.delete(article)
    db.commit()

    write_audit(db, operator, "delete", "article", article_id)
    if was_published:
        notify_revalidate(["articles", "home"])

    return ok(None, message="删除成功")


@router.put("/articles/{article_id}/publish")
def publish_article(
    article_id: int,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """发布资讯：草稿 → published，写入 published_at（状态机核心动作）。

    说明：已发布再次调用为幂等（不重复改时间戳，仅审计记录）。
    """
    article = db.get(Article, article_id)
    if article is None:
        raise not_found("资讯不存在")

    if article.status != "published":
        article.status = "published"
        # 发布时写入发布时间（UTC ISO8601，与全库时间格式一致）
        article.published_at = utc_now()
        db.commit()

    # 无论是否首次发布均记录 publish 审计（幂等）
    write_audit(
        db,
        operator,
        "publish",
        "article",
        article_id,
        {"title": article.title_json.get("zh", "")},
    )
    notify_revalidate(["articles", "home"])

    return ok(None, message="发布成功")
