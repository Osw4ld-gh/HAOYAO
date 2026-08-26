# ============================================================================
# HAOYAO 后端：公共 Pydantic Schema
# 功能：双语文本等跨模块复用的基础模型。
# 说明：en 字段默认空串——后台录入允许先填中文，双语完整性由
#       translation_complete 计算标记（技术文档 §6.5.1），不阻塞保存。
# ============================================================================

from __future__ import annotations

from pydantic import BaseModel, Field


class Bilingual(BaseModel):
    """双语文本：{"zh": "...", "en": "..."}。

    说明：zh 允许空串——描述类字段（desc/ingredients/usage）可暂缺；
    必填字段（如产品 name）由业务 schema 的 validator 单独保证。
    """

    zh: str = Field(default="", description="中文文案")
    en: str = Field(default="", description="英文文案（可暂缺）")


def to_bilingual(value: dict | None) -> Bilingual:
    """容错转换：脏数据（None/缺字段）转为空 Bilingual，避免渲染崩溃。"""
    value = value or {}
    return Bilingual(zh=value.get("zh", ""), en=value.get("en", ""))
