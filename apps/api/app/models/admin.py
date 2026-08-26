# ============================================================================
# HAOYAO 后端：系统域模型（管理员 + 操作审计）
# 功能：admin_user（单管理员账号）与 audit_log（只追加操作审计）两张表的 ORM 映射。
# 依据：《HAOYAO_官网_数据库设计文档.md》§4.2 / §4.14：
#   - audit_log.operator 为逻辑冗余（无外键），审计永不随源数据删除
#   - audit_log.action 枚举由 CHECK 约束落库兜底
#   - 物理删除策略：audit_log 不提供 UPDATE/DELETE 接口（只追加）
# ============================================================================

from __future__ import annotations

from sqlalchemy import CheckConstraint, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, JSONDictType, UTCDateTime, utc_now


class AdminUser(Base):
    """管理员账号表（单管理员）。

    业务规则（数据库文档 §4.2）：
      - 首启由环境变量 ADMIN_USERNAME / ADMIN_PASSWORD_INIT 自动创建
      - 无 updated_at（账号字段极少变更，变更走审计）
    """

    __tablename__ = "admin_user"

    # 自增主键
    id: Mapped[int] = mapped_column(primary_key=True)
    # 登录用户名：全局唯一
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    # BCrypt 密码哈希（如 $2b$12$...），明文永不入库
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    # 创建时间（UTC ISO8601），Python 侧默认生成
    created_at: Mapped[str] = mapped_column(UTCDateTime, default=utc_now, nullable=False)


class AuditLog(Base):
    """操作审计表（只追加）。

    业务规则（数据库文档 §4.14）：
      - 触发点覆盖登录/登出、全部业务增删改、启停、批量上下架、发布、改密
      - target_id 存字符串；批量操作时 target_id 置空、detail_json 记录 id 列表
      - 只追加不更新不删除
    """

    __tablename__ = "audit_log"
    # 审计动作枚举：login/logout/create/update/delete/toggle/publish/batch_status
    __table_args__ = (
        CheckConstraint(
            "action IN ('login','logout','create','update','delete',"
            "'toggle','publish','batch_status')",
            name="ck_audit_action",
        ),
    )

    # 自增主键
    id: Mapped[int] = mapped_column(primary_key=True)
    # 操作人（管理员用户名，逻辑冗余，无外键）
    operator: Mapped[str] = mapped_column(String(64), nullable=False)
    # 动作类型（枚举，CHECK 兜底）
    action: Mapped[str] = mapped_column(String(16), nullable=False)
    # 对象类型（product / article / navigation / banner / ...）
    target_type: Mapped[str] = mapped_column(String(32), nullable=False)
    # 对象 id（字符串）；批量操作时为空
    target_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # 变更明细 JSON：{"changes": [...], "target_ids": [...]}
    detail_json: Mapped[dict] = mapped_column(JSONDictType, default=dict, nullable=False)
    # 操作时间（UTC ISO8601）
    created_at: Mapped[str] = mapped_column(UTCDateTime, default=utc_now, nullable=False)
