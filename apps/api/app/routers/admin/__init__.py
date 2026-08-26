# ============================================================================
# HAOYAO 后端：后台路由聚合
# 功能：汇总各里程碑后台路由（认证/导航/分类/产品/内容），统一挂 /api/v1/admin。
# 说明：M6 媒体与配置在此追加子路由。
# ============================================================================

from __future__ import annotations

from fastapi import APIRouter

from .auth import router as auth_router
from .categories import router as categories_router
from .content import router as content_router
from .navigation import router as navigation_router
from .products import router as products_router
from .stats import router as stats_router

# 后台统一路由：挂载到 /api/v1/admin（main.py 中 include）
admin_router = APIRouter(prefix="/admin")
admin_router.include_router(auth_router)          # /admin/auth/*
admin_router.include_router(navigation_router)   # /admin/navigation*
admin_router.include_router(categories_router)   # /admin/top-categories* /admin/sub-categories*
admin_router.include_router(products_router)      # /admin/products*
admin_router.include_router(content_router)       # /admin/story /admin/timeline* /admin/articles*
admin_router.include_router(stats_router)         # /admin/translation-stats
