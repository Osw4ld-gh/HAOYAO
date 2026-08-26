# ============================================================================
# HAOYAO 后端：模型基础层
# 功能：定义 ORM 的 Base、通用 JSON 字段类型（JSONDictType）、
#       UTC 时间类型（UTCDateTime）与 UTC 时间生成函数。
# 依据：《HAOYAO_官网_数据库设计文档.md》§8.1 SQLAlchemy 映射要点：
#   - JSONDictType：SQLite 存 TEXT（JSON 字符串），PostgreSQL 迁移时走 JSONB
#   - UTCDateTime：存储 ISO8601 字符串（带 Z），输出一致
#   - created_at 由列默认生成；updated_at 由 ORM onupdate=utc_now 维护
#     （SQLite 无数据库级 ON UPDATE 触发器，禁止依赖 DDL 自动更新）
# ============================================================================

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any, TypeVar

from sqlalchemy import Text, TypeDecorator
from sqlalchemy.orm import DeclarativeBase

# 泛型类型变量：用于 JSONDictType 的返回类型标注
T = TypeVar("T")


def utc_now() -> str:
    """生成当前 UTC 时间的 ISO8601 字符串（带 Z 后缀），作为时间戳统一格式。

    说明：全库时间统一为 UTC ISO8601，前端按本地时区展示。
    """
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


class Base(DeclarativeBase):
    """ORM 模型基类。

    所有数据表模型继承本类；后续接入 Alembic 时以此作为 metadata 来源。
    """

    pass


class JSONDictType(TypeDecorator[Any]):
    """通用 JSON 字段类型（TypeDecorator 双实现）。

    - SQLite 方言：以 TEXT 存储，写入时 json.dumps、读取时 json.loads
    - PostgreSQL 方言（预留）：后续可在 process_literal_parameter 等位置
      根据 dialect.name 分支切换到 JSONB 行为，应用层代码无需变更

    参数：
        default: dict / list —— 指定字段语义，用于解析失败时的兜底空值。
    """

    impl = Text
    cache_ok = True

    def __init__(self, default: type[Any] = dict) -> None:
        """初始化：记录期望的容器类型（dict 或 list），用于容错兜底。"""
        super().__init__()
        self._default_factory = default

    def process_bind_param(self, value: Any | None, dialect: Any) -> str | None:
        """写入前处理：Python 对象（dict/list）序列化为 JSON 字符串。"""
        if value is None:
            return None
        # ensure_ascii=False：中文以原文存储，便于人工审核与 JSON1 检索
        return json.dumps(value, ensure_ascii=False)

    def process_result_value(self, value: Any | None, dialect: Any) -> Any:
        """读取后处理：JSON 字符串反序列化为 Python 对象。

        容错：若库中存在脏数据导致解析失败，返回空容器而非抛错，
        保证前台渲染不因单条脏数据白屏。
        """
        if value is None:
            return None
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            # 解析失败时按字段语义返回空 dict 或空 list
            return self._default_factory()


class UTCDateTime(TypeDecorator[str]):
    """UTC 时间字段类型（TypeDecorator 双实现）。

    - SQLite 方言：以 TEXT 存储 ISO8601 字符串（如 2026-08-26T06:00:00Z）
    - PostgreSQL 方言（预留）：迁移时可切换 TIMESTAMPTZ 行为

    说明：V1 中该类型实际为"字符串透传"，职责是锁定全库时间格式约定，
    并为 PG 迁移保留方言分支位。
    """

    impl = Text
    cache_ok = True

    def process_bind_param(self, value: str | None, dialect: Any) -> str | None:
        """写入前处理：直接透传 ISO8601 字符串（不做时区转换）。"""
        return value

    def process_result_value(self, value: Any | None, dialect: Any) -> str | None:
        """读取后处理：直接透传，保证输出格式一致。"""
        return value
