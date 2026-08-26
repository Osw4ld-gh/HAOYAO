# ============================================================================
# HAOYAO 后端：依赖注入模块
# 功能：
#   - get_db：请求级数据库会话（M1 已提供）
#   - require_admin：后台 JWT 鉴权依赖（解析 Bearer access token → 注入当前用户名）
# 依据：《HAOYAO_官网_开发技术文档.md》§5.3 / §6.2：
#   - Access Token：Bearer 头携带；Payload typ="access"
#   - 过期 → 40101；无效/缺失 → 40100；管理员被删 → 40100
# ============================================================================

from __future__ import annotations

import jwt
from fastapi import Depends, Header
from sqlalchemy.orm import Session

from ..models import AdminUser
from .db import get_db
from .errors import BizError
from .security import decode_token

__all__ = ["get_db", "require_admin"]


def require_admin(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> str:
    """后台鉴权依赖：校验 Bearer Access Token，返回当前管理员用户名。

    用法：路由函数参数声明 `operator: str = Depends(require_admin)`。

    校验链：
      1. 头缺失/非 Bearer 格式 → 40100 未认证
      2. 签名/格式无效 → 40100；过期 → 40101
      3. typ 非 "access" → 40100（防 refresh token 冒用）
      4. 管理员已不存在 → 40100
    """
    # 1) 提取 Bearer Token
    if not authorization or not authorization.startswith("Bearer "):
        raise BizError(40100, "未认证", 401)
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise BizError(40100, "未认证", 401)

    # 2) 校验令牌
    try:
        payload = decode_token(token)
    except jwt.ExpiredSignatureError:
        # 过期：前端应携带 refresh token 走刷新接口
        raise BizError(40101, "登录已过期，请刷新", 401) from None
    except jwt.PyJWTError:
        raise BizError(40100, "登录凭证无效", 401) from None

    # 3) 类型校验：仅允许 access 令牌访问后台接口
    if payload.get("typ") != "access":
        raise BizError(40100, "登录凭证类型错误", 401)

    username = payload.get("sub")
    if not username:
        raise BizError(40100, "登录凭证无效", 401)

    # 4) 管理员存在性校验（账号被删/改名后旧 token 失效）
    admin = db.query(AdminUser).filter(AdminUser.username == username).first()
    if admin is None:
        raise BizError(40100, "账号不存在", 401)

    return username


def require_refresh_token(
    refresh_token: str | None = Header(default=None, alias="Cookie"),
) -> str:
    """Refresh Token 校验：从 Cookie 中解析 refresh_token。

    说明：登录成功时后端 Set-Cookie（HttpOnly），刷新接口依赖本校验。
    Cookie 解析：手动从 "k1=v1; k2=v2" 格式提取 refresh_token。
    """
    if not refresh_token:
        raise BizError(40100, "未登录", 401)
    # 解析 Cookie 键值对
    token: str | None = None
    for part in refresh_token.split(";"):
        part = part.strip()
        if part.startswith("refresh_token="):
            token = part.split("=", 1)[1]
            break
    if not token:
        raise BizError(40100, "未登录", 401)

    try:
        payload = decode_token(token)
    except jwt.ExpiredSignatureError:
        raise BizError(40101, "登录已过期，请重新登录", 401) from None
    except jwt.PyJWTError:
        raise BizError(40100, "登录凭证无效", 401) from None

    if payload.get("typ") != "refresh":
        raise BizError(40100, "登录凭证类型错误", 401)
    username = payload.get("sub")
    if not username:
        raise BizError(40100, "登录凭证无效", 401)
    return username
