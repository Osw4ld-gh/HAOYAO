# ============================================================================
# HAOYAO 后端：前台公开路由聚合
# 功能：汇总 M3 前台全部公开接口，统一挂在 /api/v1 前缀。
# 说明：M4 追加 /story /timeline /contact /articles 等内容接口。
# ============================================================================

from __future__ import annotations

from fastapi import APIRouter

from .categories import router as categories_router
from .content import router as content_router
from .home import router as home_router
from .navigation import router as navigation_router
from .products import router as products_router
from .site_config import router as site_config_router

# 前台公开路由（无鉴权）：挂载到 /api/v1
# 说明：healthz 由 main.py 单独挂载根路径（供探针），此处不重复
public_router = APIRouter()
public_router.include_router(navigation_router)  # /navigation
public_router.include_router(categories_router)  # /categories
public_router.include_router(home_router)        # /home
public_router.include_router(products_router)    # /products
public_router.include_router(content_router)     # /story /timeline /articles /contact
public_router.include_router(site_config_router)  # /site-config
