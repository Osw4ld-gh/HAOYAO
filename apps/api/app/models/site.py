# ============================================================================
# HAOYAO 后端：配置域模型（导航 / 轮播 / 网站配置 / 媒体资源）
# 功能：navigation（主导航自关联树）、banner（首页轮播）、
#       site_setting（网站配置键值）、media_asset（媒体库资源）的 ORM 映射。
# 依据：《HAOYAO_官网_数据库设计文档.md》§4.10 / §4.11 / §4.12 / §4.13：
#   - navigation：自关联树，删除导航项级联删除子项（ON DELETE CASCADE）
#   - site_setting：固定 4 键（contact/seo/switches/featured_products），key 为主键
#   - banner：link_type 枚举 product/article/url，首页仅取 enabled=1
#   - media_asset：仅登记元数据，文件本体在对象存储；type 枚举 image/video
# ============================================================================

from __future__ import annotations

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, JSONDictType, UTCDateTime, utc_now


class Navigation(Base):
    """主导航配置表（自关联树）。

    业务规则：
      - parent_id 为空 = 顶层；删除导航项级联删除子项
      - link_type 枚举：home / category / page / news / url
      - link_value 约定见数据库文档 §4.10（分类 slug / 页面 key / 完整 URL）
      - 页脚"加入我们/客户服务"列为静态模板，不占本表
    """

    __tablename__ = "navigation"
    __table_args__ = (
        # 链接类型枚举
        CheckConstraint(
            "link_type IN ('home','category','page','news','url')",
            name="ck_nav_link_type",
        ),
    )

    # 自增主键（种子数据显式 id：1–11）
    id: Mapped[int] = mapped_column(primary_key=True)
    # 父导航 id；NULL = 顶层；删除父项级联删除子项
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("navigation.id", ondelete="CASCADE"), nullable=True
    )
    # 双语标签 {"zh":"香水","en":"Fragrance"}
    label_json: Mapped[dict] = mapped_column(JSONDictType, nullable=False)
    # 链接类型（枚举）
    link_type: Mapped[str] = mapped_column(String(16), nullable=False)
    # 链接目标：分类 slug / 页面 key / 完整 URL
    link_value: Mapped[str] = mapped_column(String(255), nullable=False)
    # 排序（升序）
    sort: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # 启用开关：1 启用 / 0 停用
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # 自关联关系：父 → 子（级联删除子项）
    children: Mapped[list[Navigation]] = relationship(
        back_populates="parent",
        cascade="all, delete-orphan",
        order_by="Navigation.sort",
    )
    # 自关联关系：子 → 父
    parent: Mapped[Navigation | None] = relationship(
        back_populates="children", remote_side=[id]
    )


class Banner(Base):
    """首页轮播表。

    业务规则：首页仅取 enabled=1 按 sort 升序；数量默认 3–5 张（PRD §4.1）。
    """

    __tablename__ = "banner"
    __table_args__ = (
        # CTA 链接类型枚举：product 产品详情 / article 资讯详情 / url 外部链接
        CheckConstraint(
            "link_type IN ('product','article','url')", name="ck_banner_link_type"
        ),
    )

    # 自增主键
    id: Mapped[int] = mapped_column(primary_key=True)
    # 轮播图 CDN 地址
    image_url: Mapped[str] = mapped_column(String(512), nullable=False)
    # 双语标题
    title_json: Mapped[dict] = mapped_column(JSONDictType, default=dict, nullable=False)
    # CTA 链接类型（默认 url）
    link_type: Mapped[str] = mapped_column(String(16), default="url", nullable=False)
    # CTA 目标（产品 id / 资讯 id / URL，可空）
    link_value: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # 排序（升序）
    sort: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # 启用开关
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class SiteSetting(Base):
    """网站配置表（键值）。

    业务规则（数据库文档 §4.12）：
      - 固定 4 键：contact / seo / switches / featured_products（预留 pagination）
      - key 为主键；value_json 存 JSON 结构（见 §4.16）
    """

    __tablename__ = "site_setting"

    # 配置键（主键）
    key: Mapped[str] = mapped_column(String(32), primary_key=True)
    # 配置值（JSON 结构）
    value_json: Mapped[dict] = mapped_column(JSONDictType, nullable=False)
    # 更新时间
    updated_at: Mapped[str] = mapped_column(
        UTCDateTime, default=utc_now, onupdate=utc_now, nullable=False
    )


class MediaAsset(Base):
    """媒体库资源表。

    业务规则（数据库文档 §4.13）：
      - 本表仅登记元数据，文件本体在对象存储（CDN 地址）
      - 上传校验在 presign 接口强制：图片 ≤10MB、视频 ≤200MB、非媒体拒绝
      - 删除记录不校验引用（引用悬空由运营流程保证）
    """

    __tablename__ = "media_asset"
    __table_args__ = (
        # 资源类型枚举：image / video
        CheckConstraint("type IN ('image','video')", name="ck_media_type"),
    )

    # 自增主键
    id: Mapped[int] = mapped_column(primary_key=True)
    # 原始文件名
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    # CDN 地址（服务端生成 media/{uuid}.{ext}）
    url: Mapped[str] = mapped_column(String(512), nullable=False)
    # 资源类型：image / video
    type: Mapped[str] = mapped_column(String(8), nullable=False)
    # 文件大小（字节）
    size: Mapped[int] = mapped_column(Integer, nullable=False)
    # 上传登记时间
    created_at: Mapped[str] = mapped_column(UTCDateTime, default=utc_now, nullable=False)
