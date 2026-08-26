# ============================================================================
# HAOYAO 后端：内容模块 Pydantic Schema（故事 / 时间轴 / 资讯）
# 功能：后台内容管理接口的请求与响应模型。
# 依据：《HAOYAO_官网_开发技术文档.md》§6.1 + 数据库文档 §4.7/§4.8/§4.9。
# ============================================================================

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from .common import Bilingual


class StoryPayload(BaseModel):
    """品牌故事保存请求体（UPSERT 固定 id=1）。"""

    title: Bilingual = Field(default_factory=lambda: Bilingual(zh="", en=""))
    content: Bilingual = Field(default_factory=lambda: Bilingual(zh="", en=""))
    hero_image: str = Field(default="", max_length=512)


class TimelineCreate(BaseModel):
    """新增时间轴条目请求体。"""

    year: int = Field(..., ge=1900, le=2100)
    title: Bilingual
    desc: Bilingual = Field(default_factory=lambda: Bilingual(zh="", en=""))
    image_url: str = Field(default="", max_length=512)
    sort: int = Field(default=0, ge=0)


class TimelineUpdate(TimelineCreate):
    """修改时间轴条目（全量更新）。"""

    pass


class ArticleCreate(BaseModel):
    """新增资讯请求体（默认草稿）。"""

    category: Literal["company", "industry"]
    title: Bilingual
    summary: Bilingual = Field(default_factory=lambda: Bilingual(zh="", en=""))
    content: Bilingual = Field(default_factory=lambda: Bilingual(zh="", en=""))
    cover_url: str = Field(default="", max_length=512)


class ArticleUpdate(ArticleCreate):
    """修改资讯请求体（全量更新）。"""

    pass


class ArticlePublish(BaseModel):
    """发布请求体（草稿 → 已发布）。"""

    pass
