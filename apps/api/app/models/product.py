# ============================================================================
# HAOYAO 后端：核心业务域模型（产品）
# 功能：product（产品）与 product_image（产品图片）的 ORM 映射。
# 依据：《HAOYAO_官网_数据库设计文档.md》§4.5 / §4.6：
#   - product.ref_code 唯一约束落库（本文档增强，防并发重复）
#   - price 为整数分（≥0），禁止浮点
#   - status 枚举 on/off，下架前台不可见（应用层过滤）
#   - 删除产品级联删除图片记录（ON DELETE CASCADE）
#   - 单主图约束由应用层保证（每个产品最多 1 张 is_cover=1），不落库
# ============================================================================

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, JSONDictType, UTCDateTime, utc_now

# 仅类型检查时导入（避免 models 包内循环导入：product ↔ category）
if TYPE_CHECKING:
    from .category import SubCategory


class Product(Base):
    """产品表。

    列表查询固定排序：ORDER BY is_new DESC, sort ASC, id ASC（稳定排序 D5）。
    """

    __tablename__ = "product"
    __table_args__ = (
        # 价格非负（整数分）
        CheckConstraint("price >= 0", name="ck_product_price"),
        # 状态枚举：on 上架 / off 下架
        CheckConstraint("status IN ('on','off')", name="ck_product_status"),
    )

    # 自增主键
    id: Mapped[int] = mapped_column(primary_key=True)
    # 所属二级分类（无级联：删除含产品分类由应用层拦截）
    sub_id: Mapped[int] = mapped_column(ForeignKey("sub_category.id"), nullable=False)
    # 双语名称 {"zh":"焕颜精华","en":"Radiance Serum"}
    name_json: Mapped[dict] = mapped_column(JSONDictType, nullable=False)
    # 参考编号（业务自然键，UNIQUE 落库生成隐式索引）
    ref_code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    # 价格（整数分，0 表示未定价占位）
    price: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # 功效描述（双语富文本）
    desc_json: Mapped[dict] = mapped_column(JSONDictType, default=dict, nullable=False)
    # 成分（双语富文本）
    ingredients_json: Mapped[dict] = mapped_column(JSONDictType, default=dict, nullable=False)
    # 使用方式（双语富文本）
    usage_json: Mapped[dict] = mapped_column(JSONDictType, default=dict, nullable=False)
    # 色号列表（数组，无该产品色号时存 []）；default 同时供 ORM 与 JSON 类型使用
    variants_json: Mapped[list] = mapped_column(
        JSONDictType(default=list), default=list, nullable=False
    )
    # 新品标记
    is_new: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # 上架状态：on / off（默认下架）
    status: Mapped[str] = mapped_column(String(8), default="off", nullable=False)
    # 展示排序（升序）
    sort: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # 创建/更新时间
    created_at: Mapped[str] = mapped_column(UTCDateTime, default=utc_now, nullable=False)
    updated_at: Mapped[str] = mapped_column(
        UTCDateTime, default=utc_now, onupdate=utc_now, nullable=False
    )

    # 关系：产品 → 二级分类（多对一）；注解经 TYPE_CHECKING 导入解析
    sub_category: Mapped[SubCategory] = relationship(back_populates="products")
    # 关系：产品 → 图片（1:N，删除产品级联删除图片记录）
    images: Mapped[list[ProductImage]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="ProductImage.sort",
    )


class ProductImage(Base):
    """产品图片表（主图 + 多图）。

    业务规则：
      - 每个产品最多 1 张主图：由应用层接口校验（images 至少 1 张且仅 1 张 is_cover）
      - 不做部分索引落库（SQLite 部分索引与 PostgreSQL 不通用，避免迁移成本）
    """

    __tablename__ = "product_image"

    # 自增主键
    id: Mapped[int] = mapped_column(primary_key=True)
    # 所属产品；删除产品级联删除图片记录
    product_id: Mapped[int] = mapped_column(
        ForeignKey("product.id", ondelete="CASCADE"), nullable=False
    )
    # CDN 图片地址
    url: Mapped[str] = mapped_column(String(512), nullable=False)
    # 是否主图（0/1）
    is_cover: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # 展示排序
    sort: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # 关系：图片 → 产品（多对一）
    product: Mapped[Product] = relationship(back_populates="images")
