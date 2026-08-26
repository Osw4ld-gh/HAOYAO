# ============================================================================
# HAOYAO 后端：认证相关 Pydantic Schema
# 功能：登录/刷新/登出接口的请求与响应模型。
# 依据：《HAOYAO_官网_开发技术文档.md》§6.3 认证接口。
# ============================================================================

from __future__ import annotations

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    """登录请求体：用户名 + 密码。"""

    username: str = Field(..., min_length=1, max_length=64, description="管理员用户名")
    password: str = Field(..., min_length=1, max_length=72, description="登录密码")


class TokenResponse(BaseModel):
    """登录/刷新成功响应数据：access token 与有效期。"""

    access_token: str
    expires_in: int  # 秒（Access Token 有效期）


class LockedResponse(BaseModel):
    """账号锁定响应数据：解锁时间（UTC ISO8601）。"""

    locked_until: str


class ChangePasswordBody(BaseModel):
    """修改密码请求体：旧密码校验 + 新密码强度约束。"""

    old_password: str = Field(..., min_length=1, max_length=72)
    new_password: str = Field(
        ...,
        min_length=8,
        max_length=72,
        description="新密码：至少 8 位且含字母与数字",
    )
