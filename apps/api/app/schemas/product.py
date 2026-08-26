# ============================================================================
# HAOYAO 后端：产品管理 Pydantic Schema
# 功能：产品 CRUD / 批量上下架的请求与响应模型（含图片、色号）。
# 依据：《HAOYAO_官网_开发技术文档.md》§6.5.1 产品管理：
#   - 请求体使用 name/desc/ingredients/usage/variants/images（无 _json 后缀），
#     与数据库 *_json 字段由路由层做映射转换
#   - 校验：name.zh 必填；ref_code 唯一（40900）；price ≥ 0；
#     images 至少 1 张且仅 1 张 is_cover
# ============================================================================

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from .common import Bilingual


class ProductImageItem(BaseModel):
    """产品图片条目：url + 是否主图。"""

    url: str = Field(..., max_length=512, description="CDN 图片地址（M6 前 URL 直填）")
    is_cover: bool = False


class VariantItem(BaseModel):
    """产品色号条目（数据库文档 §4.16 variants_json）。"""

    name: Bilingual
    image_url: str = Field(default="", max_length=512)


class ProductCreate(BaseModel):
    """新增产品请求体。"""

    sub_id: int
    name: Bilingual
    ref_code: str = Field(..., min_length=1, max_length=64)
    price: int = Field(default=0, ge=0, description="整数分，≥0")
    desc: Bilingual = Field(default_factory=lambda: Bilingual(zh="", en=""))
    ingredients: Bilingual = Field(default_factory=lambda: Bilingual(zh="", en=""))
    usage: Bilingual = Field(default_factory=lambda: Bilingual(zh="", en=""))
    variants: list[VariantItem] = Field(default_factory=list)
    is_new: bool = False
    status: Literal["on", "off"] = "off"
    sort: int = Field(default=0, ge=0)
    images: list[ProductImageItem] = Field(..., min_length=1, description="至少 1 张图片")

    # 业务校验 1：name.zh 必填（技术文档 §6.5.1；Bilingual.zh 允许空，此处收口）
    @field_validator("name")
    @classmethod
    def validate_name_zh(cls, name: Bilingual) -> Bilingual:
        if not name.zh.strip():
            raise ValueError("产品中文名称（name.zh）必填")
        return name

    # 业务校验 2：images 中主图（is_cover=True）必须恰好 1 张（数据库文档 §4.6）
    @field_validator("images")
    @classmethod
    def validate_single_cover(cls, images: list[ProductImageItem]) -> list[ProductImageItem]:
        cover_count = sum(1 for img in images if img.is_cover)
        if cover_count != 1:
            raise ValueError("images 必须且只能包含 1 张主图（is_cover=true）")
        return images


class ProductUpdate(ProductCreate):
    """修改产品请求体：字段与创建一致（全量更新）。"""

    pass


class BatchStatusRequest(BaseModel):
    """批量上/下架请求体。"""

    ids: list[int] = Field(..., min_length=1, description="产品 id 列表（非空）")
    status: Literal["on", "off"]


class BatchStatusResult(BaseModel):
    """批量操作响应数据。"""

    updated: int
