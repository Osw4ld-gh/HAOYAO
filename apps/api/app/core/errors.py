# ============================================================================
# HAOYAO 后端：业务异常定义
# 功能：统一业务错误（携带业务 code / message / HTTP 状态码），
#       由 main.py 注册的全局 handler 转为统一响应包 {code, message, data}。
# 依据：《HAOYAO_官网_开发技术文档.md》§6.2 错误码表：
#   40000 参数校验失败 / 40100 未认证 / 40101 token 过期 / 40102 登录失败
#   40103 账号锁定 / 40300 无权限 / 40400 资源不存在 / 40900 冲突
#   42200 业务校验失败 / 42900 请求过频 / 50000 服务器内部错误
# ============================================================================

from __future__ import annotations


class BizError(Exception):
    """业务异常。

    属性：
        code: 业务错误码（对应 §6.2 错误码表）
        message: 面向用户的错误信息
        status_code: HTTP 状态码（传输层语义）
    """

    def __init__(self, code: int, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


# ---------- 常用业务错误工厂（语义化命名，便于路由层一行抛出） ----------

def not_found(message: str = "资源不存在") -> BizError:
    """资源不存在（40400 / HTTP 404）：产品下架详情、删除目标不存在等。"""
    return BizError(40400, message, 404)


def conflict(message: str = "资源冲突") -> BizError:
    """冲突（40900 / HTTP 409）：slug / ref_code 重复等。"""
    return BizError(40900, message, 409)


def validation(message: str = "业务校验失败") -> BizError:
    """业务校验失败（42200 / HTTP 422）：删除含子项、含产品禁删等。"""
    return BizError(42200, message, 422)


def forbidden(message: str = "无权限") -> BizError:
    """无权限（40300 / HTTP 403）：预留角色不符场景。"""
    return BizError(40300, message, 403)
