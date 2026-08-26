# ============================================================================
# HAOYAO 后端：核心业务域模型（分类体系）
# 功能：top_category（顶层分类）与 sub_category（二级分类）的 ORM 映射。
# 依据：《HAOYAO_官网_数据库设计文档.md》§4.3 / §4.4：
#   - top_category 无名称字段，前台名称由 navigation.label_json 提供（导航驱动 D4）
#   - sub_category 同 top_id 下 slug 唯一（复合唯一约束）
#   - 删除顶层分类级联删除二级分类（ON DELETE CASCADE）
#   - 二级分类删除前若含产品，应用层拒绝（42200 SUBCAT_HAS_PRODUCTS）
# ============================================================================

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, JSONDictType, UTCDateTime, utc_now

# 仅类型检查时导入（避免 models 包内循环导入：category ↔ product）
if TYPE_CHECKING:
    from .product import Product


class TopCategory(Base):
    """顶层分类表（香水/彩妆/护肤品）。

    说明：表内无名称字段——前台展示名称由导航表 label_json 提供，
    导航缺失时回退 slug 原文（详见数据库文档 §4.3 决策）。
    """

    __tablename__ = "top_category"

    # 自增主键（种子数据显式 id：1/2/3）
    id: Mapped[int] = mapped_column(primary_key=True)
    # URL 标识，路由段（fragrance / makeup / skincare），全局唯一
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    # 展示排序（升序）
    sort: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # 启用开关：1 启用 / 0 停用
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # 创建/更新时间（UTC ISO8601）；updated_at 由 ORM onupdate 维护
    created_at: Mapped[str] = mapped_column(UTCDateTime, default=utc_now, nullable=False)
    updated_at: Mapped[str] = mapped_column(
        UTCDateTime, default=utc_now, onupdate=utc_now, nullable=False
    )

    # 关系：顶层 → 二级（1:N，删除顶层级联删除二级）
    sub_categories: Mapped[list[SubCategory]] = relationship(
        back_populates="top_category",
        cascade="all, delete-orphan",
        order_by="SubCategory.sort",
    )


class SubCategory(Base):
    """二级分类表（女士/男士、底妆/唇妆/…、清洁/水润/…）。

    业务规则：
      - slug 在同顶层下唯一（复合唯一约束 UNIQUE(top_id, slug)）
      - 含产品时禁止删除（应用层拦截，无级联）
    """

    __tablename__ = "sub_category"
    __table_args__ = (
        # 同 top_id 下 slug 唯一
        UniqueConstraint("top_id", "slug", name="ux_sub_top_slug"),
    )

    # 自增主键（种子数据显式 id：1–12）
    id: Mapped[int] = mapped_column(primary_key=True)
    # 所属顶层分类；删除顶层级联删除本行
    top_id: Mapped[int] = mapped_column(
        ForeignKey("top_category.id", ondelete="CASCADE"), nullable=False
    )
    # 二级 slug（同顶层下唯一）
    slug: Mapped[str] = mapped_column(String(64), nullable=False)
    # 双语名称 {"zh":"精华","en":"Serums"}
    name_json: Mapped[dict] = mapped_column(JSONDictType, nullable=False)
    # 展示排序（升序）
    sort: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # 创建/更新时间
    created_at: Mapped[str] = mapped_column(UTCDateTime, default=utc_now, nullable=False)
    updated_at: Mapped[str] = mapped_column(
        UTCDateTime, default=utc_now, onupdate=utc_now, nullable=False
    )

    # 关系：二级 → 顶层（多对一）
    top_category: Mapped[TopCategory] = relationship(back_populates="sub_categories")
    # 关系：二级 → 产品（1:N，无级联——含产品禁删由应用层保证）
    # 注解经 TYPE_CHECKING 导入解析（__future__ 下运行时不求值）
    products: Mapped[list[Product]] = relationship(back_populates="sub_category")
