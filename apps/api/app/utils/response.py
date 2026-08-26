# ============================================================================
# HAOYAO 后端：统一响应包工具
# 功能：封装成功/失败响应结构，全站接口统一 `{code, message, data}` 格式。
# 依据：《HAOYAO_官网_开发技术文档.md》§5.4：
#   - 成功：{"code": 0, "message": "ok", "data": {...}}
#   - 失败：HTTP 状态码表达传输层语义，code 表达业务错误细分（§6.2 错误码表）
# ============================================================================

from __future__ import annotations

from typing import Any

from fastapi.responses import JSONResponse

# 错误码常量（对齐技术文档 §6.2 错误码表，业务层直接引用）
CODE_OK = 0
CODE_VALIDATION_ERROR = 40000      # 参数校验失败
CODE_UNAUTHORIZED = 40100          # 未认证
CODE_TOKEN_EXPIRED = 40101         # token 过期
CODE_LOGIN_FAILED = 40102          # 登录失败
CODE_ACCOUNT_LOCKED = 40103        # 账号锁定
CODE_FORBIDDEN = 40300             # 无权限
CODE_NOT_FOUND = 40400             # 资源不存在
CODE_CONFLICT = 40900              # 冲突（slug/ref_code 重复）
CODE_BUSINESS_ERROR = 42200        # 业务校验失败
CODE_TOO_MANY_REQUESTS = 42900     # 请求过频
CODE_SERVER_ERROR = 50000          # 服务器内部错误


def ok(data: Any = None, message: str = "ok") -> dict[str, Any]:
    """构造成功响应体（HTTP 200 默认由 FastAPI 处理）。"""
    return {"code": CODE_OK, "message": message, "data": data}


def fail(code: int, message: str, status_code: int = 400, data: Any = None) -> JSONResponse:
    """构造失败响应（携带业务 code 与 HTTP 状态码）。

    参数：
        code: 业务错误码（见错误码表）
        message: 面向用户的错误提示
        status_code: HTTP 状态码（400/401/403/404/409/422/429/500）
        data: 可选的附加信息（如账号锁定的解锁时间），默认 None
    """
    return JSONResponse(
        status_code=status_code,
        content={"code": code, "message": message, "data": data},
    )
