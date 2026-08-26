# ============================================================================
# HAOYAO 后端：操作审计写入工具
# 功能：统一封装审计日志写入，全部后台写操作（含登录/登出）接入。
# 依据：《HAOYAO_官网_数据库设计文档.md》§4.14 / 《开发技术文档》§5.6：
#   - 触发点：login/logout/create/update/delete/toggle/publish/batch_status
#   - target_id 存字符串；批量操作 target_id 置空、detail_json 记录 id 列表
#   - 审计只追加不更新不删除
# 横切要求：M2/M4/M6 所有模块 CRUD 均需调用本函数（方案 V1.1 §4-M2）。
# ============================================================================

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from ..models import AuditLog


def write_audit(
    db: Session,
    operator: str,
    action: str,
    target_type: str,
    target_id: int | str | None = None,
    detail: dict[str, Any] | None = None,
) -> None:
    """写入一条审计记录并提交。

    参数：
        operator: 操作人（管理员用户名）
        action: 动作枚举（login/logout/create/update/delete/toggle/publish/batch_status）
        target_type: 对象类型（product/sub_category/top_category/article/...）
        target_id: 对象 id（批量操作传 None，id 列表放 detail["target_ids"]）
        detail: 变更明细 {"changes": [...], ...}
    """
    db.add(
        AuditLog(
            operator=operator,
            action=action,
            target_type=target_type,
            # 统一转为字符串存储；无 id 时存 NULL
            target_id=str(target_id) if target_id is not None else None,
            detail_json=detail or {},
        )
    )
    db.commit()
