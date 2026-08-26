# ============================================================================
# HAOYAO 后端：认证路由（登录/刷新/登出）
# 功能：
#   - POST /admin/auth/login    登录（限流 5 次/15min + BCrypt + JWT 双令牌 + 审计）
#   - POST /admin/auth/refresh  用 Refresh Cookie 换取新 access（并轮换 refresh）
#   - POST /admin/auth/logout   清除 Refresh Cookie + 审计 logout
# 依据：《HAOYAO_官网_开发技术文档.md》§5.3 / §6.3：
#   - Access Token 2h（响应体返回）；Refresh Token 14d（HttpOnly Cookie）
#   - 连续失败 5 次锁定 15 分钟（内存限流器，服务层 M1 已实现）
#   - 失败响应带剩余次数；锁定响应带解锁时间
# ============================================================================

# mypy: disable-error-code="no-untyped-def"
# 说明：FastAPI 路由返回类型由 OpenAPI 自动处理，标注 union 反而污染 schema，故豁免该规则。

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from ...core.config import settings
from ...core.db import get_db
from ...core.deps import require_admin, require_refresh_token
from ...core.security import (
    create_access_token,
    create_refresh_token,
    verify_password,
)
from ...models import AdminUser
from ...schemas.auth import LoginRequest, TokenResponse
from ...services.rate_limit import rate_limiter
from ...utils.audit import write_audit
from ...utils.response import fail, ok

router = APIRouter(prefix="/auth", tags=["admin-auth"])

# Refresh Cookie 名称与路径（技术文档 §5.3：Path=/api/v1/admin/auth）
_REFRESH_COOKIE = "refresh_token"
_REFRESH_COOKIE_PATH = "/api/v1/admin/auth"


def _set_refresh_cookie(response: Response, token: str) -> None:
    """写入 Refresh Token HttpOnly Cookie。

    安全属性：HttpOnly（防 XSS 读取）+ SameSite=Lax + Max-Age 14 天。
    Secure 在生产（HTTPS）由环境变量控制：本地 http 开发时不启用。
    """
    response.set_cookie(
        key=_REFRESH_COOKIE,
        value=token,
        max_age=settings.JWT_REFRESH_TTL_DAYS * 24 * 3600,
        httponly=True,
        samesite="lax",
        secure=settings.ENVIRONMENT == "production",
        path=_REFRESH_COOKIE_PATH,
    )


@router.post("/login")
def login(body: LoginRequest, response: Response, db: Session = Depends(get_db)):
    """登录：校验账号密码 → 签发双令牌 → 写审计。

    限流逻辑：
      - 账号锁定中 → 40103（423，携带解锁时间）
      - 密码错误 → 40102（401，携带剩余次数）；达 5 次触发锁定
      - 成功 → 200 + access_token + Set-Cookie refresh
    """
    username = body.username.strip()

    # 1) 限流预检：锁定中直接拒绝（不泄露密码是否正确）
    if rate_limiter.is_locked(username):
        # is_locked 已确认锁定，locked_until 必非 None（防御性兜底 0）
        locked_until = rate_limiter.locked_until(username) or 0.0
        locked_at = datetime.fromtimestamp(locked_until, tz=UTC).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        )
        return fail(40103, "连续失败次数过多，账号已锁定", 423, data={"locked_until": locked_at})

    # 2) 查询管理员并校验密码
    admin = db.query(AdminUser).filter(AdminUser.username == username).first()
    if admin is None or not verify_password(body.password, admin.password_hash):
        # 记录一次失败；返回剩余次数
        remaining = rate_limiter.record_failure(username)
        if remaining <= 0:
            # 本次失败触发锁定：锁定状态对后续请求生效
            # record_failure 已写入 locked_until，此处防御性兜底 0
            locked_until = rate_limiter.locked_until(username) or 0.0
            locked_at = datetime.fromtimestamp(locked_until, tz=UTC).strftime(
                "%Y-%m-%dT%H:%M:%SZ"
            )
            return fail(
                40103, "连续失败次数过多，账号已锁定", 423, data={"locked_until": locked_at}
            )
        return fail(
            40102,
            f"用户名或密码错误，剩余 {remaining} 次尝试机会",
            401,
        )

    # 3) 登录成功：清除失败计数，签发双令牌
    rate_limiter.reset(username)
    access_token = create_access_token(username)
    refresh_token = create_refresh_token(username)
    _set_refresh_cookie(response, refresh_token)

    # 4) 审计：login（操作人即登录者）
    write_audit(db, operator=username, action="login", target_type="admin_user", target_id=admin.id)

    return ok(
        TokenResponse(
            access_token=access_token,
            expires_in=settings.JWT_ACCESS_TTL_MINUTES * 60,
        ).model_dump()
    )


@router.post("/refresh")
def refresh(
    response: Response,
    username: str = Depends(require_refresh_token),
    db: Session = Depends(get_db),
):
    """刷新：用 Refresh Cookie 换取新 access，并轮换 refresh。

    轮换策略：签发新 refresh 并覆盖 Cookie（旧 refresh 立即失效）。
    """
    # 签发新双令牌（refresh 轮换）
    access_token = create_access_token(username)
    new_refresh = create_refresh_token(username)
    _set_refresh_cookie(response, new_refresh)

    return ok(
        TokenResponse(
            access_token=access_token,
            expires_in=settings.JWT_ACCESS_TTL_MINUTES * 60,
        ).model_dump()
    )


@router.post("/logout")
def logout(
    response: Response,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """登出：清除 Refresh Cookie + 审计 logout。

    说明：Access Token 无服务端状态（JWT），前端删除本地 token 即完成前端侧失效。
    """
    # 清除 Cookie（Max-Age=0 立即过期）
    response.delete_cookie(_REFRESH_COOKIE, path=_REFRESH_COOKIE_PATH)

    # 审计：logout
    write_audit(db, operator=operator, action="logout", target_type="admin_user")

    return ok(None, message="已登出")
