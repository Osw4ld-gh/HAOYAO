# ============================================================================
# HAOYAO 后端：健康检查路由
# 功能：GET /healthz —— 可用性探针，供 Docker healthcheck 与云监控使用。
# 依据：《HAOYAO_官网_开发技术文档.md》§9.6：
#   - /healthz（api）纳入监控，可用性 ≥99.9%
#   - 健康检查需验证数据库连通性（DB 异常时探针应失败）
# ============================================================================

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from ...core.db import get_db
from ...utils.response import ok

router = APIRouter(tags=["health"])


@router.get("/healthz")
def healthz(db: Session = Depends(get_db)) -> dict:
    """健康检查：返回服务与数据库状态。

    说明：执行一次轻量 SELECT 验证 DB 连接可用；
    异常时由全局异常处理器返回 500（探针据此判定不健康）。
    """
    # 轻量连通性探测（1 行查询，不加载业务数据）
    db.execute(text("SELECT 1"))
    return ok({"status": "ok", "db": "ok"}, message="healthy")
