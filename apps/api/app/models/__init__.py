# ============================================================================
# HAOYAO 后端：模型包统一导出
# 功能：汇总全部 13 张表的 ORM 模型，供 init_db / create_all / 业务层引用。
# 依据：《HAOYAO_官网_数据库设计文档.md》§1.1 —— 13 张表全量覆盖
#   admin_user / top_category / sub_category / product / product_image /
#   article / story / timeline / navigation / banner / site_setting /
#   media_asset / audit_log
# ============================================================================

from .admin import AdminUser, AuditLog
from .base import Base, JSONDictType, UTCDateTime, utc_now
from .category import SubCategory, TopCategory
from .content import Article, Story, Timeline
from .product import Product, ProductImage
from .site import Banner, MediaAsset, Navigation, SiteSetting

__all__ = [
    # 基础类型
    "Base",
    "JSONDictType",
    "UTCDateTime",
    "utc_now",
    # 系统域
    "AdminUser",
    "AuditLog",
    # 核心业务域
    "TopCategory",
    "SubCategory",
    "Product",
    "ProductImage",
    # 内容域
    "Article",
    "Story",
    "Timeline",
    # 配置域
    "Navigation",
    "Banner",
    "SiteSetting",
    "MediaAsset",
]
