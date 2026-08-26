# ============================================================================
# HAOYAO 后端：内容域模型（资讯 / 品牌故事 / 发展历程）
# 功能：article（资讯）、story（品牌故事单行）、timeline（时间轴）的 ORM 映射。
# 依据：《HAOYAO_官网_数据库设计文档.md》§4.7 / §4.8 / §4.9：
#   - article：category 枚举 company/industry；status 枚举 draft/published；
#     发布时同步写 published_at（应用层保证），草稿为空
#   - story：CHECK(id=1) 强制单行；后台"保存"即 UPSERT
#   - timeline：前台按年份倒序展示（接口层 ORDER BY year DESC, sort ASC）
# ============================================================================

from __future__ import annotations

from sqlalchemy import CheckConstraint, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, JSONDictType, UTCDateTime, utc_now


class Article(Base):
    """资讯表（企业新闻/行业资讯）。

    业务规则：
      - 仅 status='published' 前台可见；列表按 published_at DESC
      - 发布动作写 published_at=now()，草稿置空（应用层状态机保证）
    """

    __tablename__ = "article"
    __table_args__ = (
        # 分类枚举：company 企业新闻 / industry 行业资讯
        CheckConstraint("category IN ('company','industry')", name="ck_article_category"),
        # 状态枚举：draft 草稿 / published 已发布
        CheckConstraint("status IN ('draft','published')", name="ck_article_status"),
    )

    # 自增主键
    id: Mapped[int] = mapped_column(primary_key=True)
    # 资讯分类（独立于产品分类体系，无 top_id 关联）
    category: Mapped[str] = mapped_column(String(16), nullable=False)
    # 双语标题
    title_json: Mapped[dict] = mapped_column(JSONDictType, nullable=False)
    # 双语摘要
    summary_json: Mapped[dict] = mapped_column(JSONDictType, default=dict, nullable=False)
    # 双语正文（富文本）
    content_json: Mapped[dict] = mapped_column(JSONDictType, default=dict, nullable=False)
    # 封面图 CDN 地址（可空）
    cover_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    # 发布时间（UTC）；草稿为空
    published_at: Mapped[str | None] = mapped_column(UTCDateTime, nullable=True)
    # 状态：draft / published（默认草稿）
    status: Mapped[str] = mapped_column(String(16), default="draft", nullable=False)
    # 创建/更新时间
    created_at: Mapped[str] = mapped_column(UTCDateTime, default=utc_now, nullable=False)
    updated_at: Mapped[str] = mapped_column(
        UTCDateTime, default=utc_now, onupdate=utc_now, nullable=False
    )


class Story(Base):
    """品牌故事表（单行）。

    业务规则：CHECK(id=1) 落库强制单行；后台保存即 UPSERT 固定行。
    """

    __tablename__ = "story"
    __table_args__ = (
        # 单行约束：固定主键 id=1
        CheckConstraint("id = 1", name="ck_story_single_row"),
    )

    # 固定主键 1
    id: Mapped[int] = mapped_column(primary_key=True)
    # 双语标题
    title_json: Mapped[dict] = mapped_column(JSONDictType, default=dict, nullable=False)
    # 双语正文（富文本）
    content_json: Mapped[dict] = mapped_column(JSONDictType, default=dict, nullable=False)
    # 首屏大图 CDN 地址（可空）
    hero_image: Mapped[str | None] = mapped_column(String(512), nullable=True)
    # 更新时间
    updated_at: Mapped[str] = mapped_column(
        UTCDateTime, default=utc_now, onupdate=utc_now, nullable=False
    )


class Timeline(Base):
    """发展历程时间轴表。

    业务规则：前台按年份倒序展示（接口层 ORDER BY year DESC, sort ASC）。
    """

    __tablename__ = "timeline"

    # 自增主键
    id: Mapped[int] = mapped_column(primary_key=True)
    # 年份（如 2020）
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    # 双语标题
    title_json: Mapped[dict] = mapped_column(JSONDictType, nullable=False)
    # 双语描述
    desc_json: Mapped[dict] = mapped_column(JSONDictType, default=dict, nullable=False)
    # 配图 CDN 地址（可空）
    image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    # 排序（与年份倒序一致）
    sort: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
