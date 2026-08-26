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
from ...models import Article, Product
from ...utils.response import ok

router = APIRouter(prefix="/translation-stats", tags=["admin-stats"])


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
