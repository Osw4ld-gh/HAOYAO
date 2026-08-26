# ============================================================================
# HAOYAO 后端：分类体系 Pydantic Schema
# 功能：顶层/二级分类 CRUD 的请求与响应模型。
# 依据：《HAOYAO_官网_开发技术文档.md》§6.1 接口总览 + 数据库文档 §4.3/§4.4：
#   - top_category 无名称字段（名称由导航表提供），仅 slug/sort/enabled
#   - sub_category 含 name_json（双语名称）
# ============================================================================

from __future__ import annotations

from pydantic import BaseModel, Field

from .common import Bilingual


class TopCategoryCreate(BaseModel):
    """新增顶层分类请求体。"""

    slug: str = Field(
        ...,
        min_length=1,
        max_length=64,
        pattern=r"^[a-z0-9-]+$",
        description="URL 标识（小写字母/数字/连字符）",
    )
    sort: int = Field(default=0, ge=0)
    enabled: bool = True


class TopCategoryUpdate(BaseModel):
    """修改顶层分类请求体（全量更新）。"""

    slug: str = Field(..., min_length=1, max_length=64, pattern=r"^[a-z0-9-]+$")
    sort: int = Field(default=0, ge=0)
    enabled: bool = True


class SubCategoryCreate(BaseModel):
    """新增二级分类请求体。"""

    top_id: int
    slug: str = Field(..., min_length=1, max_length=64, pattern=r"^[a-z0-9-]+$")
    name: Bilingual
    sort: int = Field(default=0, ge=0)


class SubCategoryUpdate(BaseModel):
    """修改二级分类请求体（全量更新）。"""

    top_id: int
    slug: str = Field(..., min_length=1, max_length=64, pattern=r"^[a-z0-9-]+$")
    name: Bilingual
    sort: int = Field(default=0, ge=0)
