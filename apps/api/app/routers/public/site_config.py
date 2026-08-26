# ============================================================================
# HAOYAO 后端：前台公开接口 —— 网站配置（聚合只读）
# 功能：GET /site-config —— 返回 contact/seo/switches/featured_products 4 键聚合。
# 依据：M6 前台接入 site-config 校验 / 技术文档 §6.4.5（前台公开路由）。
# 说明：与后台 /admin/site-config 的区别是此接口无鉴权、只读，驱动前台页脚
#       与产品卡（价格/新品标签）等动态开关。前台缓存策略：ISR/SSR revalidate=0。
# ============================================================================

# mypy: disable-error-code="no-untyped-def"
# 说明：FastAPI 路由返回类型由 OpenAPI 自动处理，故豁免该规则。

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...core.db import get_db
from ...models import SiteSetting
from ...utils.response import ok

router = APIRouter(prefix="/site-config", tags=["public-site-config"])

# 固定 4 键（数据库文档 §4.12）
SITE_KEYS = ("contact", "seo", "switches", "featured_products")


@router.get("")
def get_public_site_config(db: Session = Depends(get_db)):
    """前台公开网站配置：4 键聚合（contact/seo/switches/featured_products）。

    featured_products 列表透传（不强制 dict）；其他键未配置时返回空 dict。
    """
    rows = db.query(SiteSetting).filter(SiteSetting.key.in_(SITE_KEYS)).all()
    data: dict = {k: {} for k in SITE_KEYS}
    for row in rows:
        value = row.value_json
        data[row.key] = value if isinstance(value, (dict, list)) else {}
    return ok(data)
