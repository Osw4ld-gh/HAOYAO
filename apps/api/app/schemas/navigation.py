# ============================================================================
# HAOYAO 后端：导航配置 Pydantic Schema
# 功能：后台导航 CRUD 的请求模型与树形节点响应模型。
# 依据：《HAOYAO_官网_开发技术文档.md》§6.5.2 导航配置。
# ============================================================================

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from .common import Bilingual

# 链接类型枚举（数据库文档 §4.10）：home/category/page/news/url
LinkType = Literal["home", "category", "page", "news", "url"]


class NavNode(BaseModel):
    """导航树节点（响应）：含父级 id 与子节点 children（递归组装）。"""

    id: int
    parent_id: int | None
    label: Bilingual
    link_type: LinkType
    link_value: str
    sort: int
    enabled: bool
    children: list[NavNode] = Field(default_factory=list)


class NavCreate(BaseModel):
    """新增导航请求体。"""

    parent_id: int | None = Field(default=None, description="父导航 id；None=顶层")
    label: Bilingual
    link_type: LinkType
    link_value: str = Field(..., max_length=255)
    sort: int = Field(default=0, ge=0)
    enabled: bool = True


class NavUpdate(BaseModel):
    """修改导航请求体（全量更新：前端提交完整表单）。"""

    parent_id: int | None = None
    label: Bilingual
    link_type: LinkType
    link_value: str = Field(..., max_length=255)
    sort: int = Field(default=0, ge=0)
    enabled: bool = True


class NavToggle(BaseModel):
    """启停请求体：enabled 目标值。"""

    enabled: bool
