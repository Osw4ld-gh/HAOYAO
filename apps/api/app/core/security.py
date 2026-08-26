# ============================================================================
# HAOYAO 后端：安全模块（密码哈希 + JWT）
# 功能：BCrypt 密码哈希/校验，JWT 双令牌（access/refresh）签发与校验。
# 依据：《HAOYAO_官网_开发技术文档.md》§5.3 认证模块：
#   - Access Token 有效期 2h，Payload: {sub, exp, iat, typ:"access"}
#   - Refresh Token 有效期 14d，HttpOnly Cookie 承载
#   - 本模块在 M1 提供完整实现骨架，M2 认证接口直接复用
# 技术决策：直接使用 bcrypt 官方库（而非 passlib 封装）。
#   原因：passlib 1.7.4 已停止维护，与 bcrypt>=4.1 存在已知兼容问题
#   （缺失 __about__ 属性导致版本检测失败、72 字节校验行为变化），
#   直接调用 bcrypt 实现完全等价且更可靠。
# ============================================================================

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from .config import settings

# BCrypt 算法开销因子：12（业界常用，兼顾安全与性能）
_BCRYPT_ROUNDS = 12
# BCrypt 输入长度硬限制（算法本身只取前 72 字节，超限静默截断不安全）
_BCRYPT_MAX_BYTES = 72


def _validate_password_length(password: str) -> bytes:
    """校验并编码密码：超过 BCrypt 72 字节限制时显式报错。

    说明：bcrypt 4.x 对超长输入直接抛 ValueError；此处统一转为
    业务语义明确的异常信息，避免不同版本行为差异导致隐性问题。
    """
    encoded = password.encode("utf-8")
    if len(encoded) > _BCRYPT_MAX_BYTES:
        raise ValueError(f"密码长度不能超过 {_BCRYPT_MAX_BYTES} 字节（UTF-8 编码后）")
    return encoded


def hash_password(password: str) -> str:
    """明文密码 → BCrypt 哈希（自动加盐，每次结果不同，禁止逆推）。"""
    return bcrypt.hashpw(
        _validate_password_length(password), bcrypt.gensalt(rounds=_BCRYPT_ROUNDS)
    ).decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    """校验明文密码与 BCrypt 哈希是否匹配。

    说明：哈希格式非法（如占位文本）时返回 False 而非抛错，
    保证登录接口对脏数据优雅降级。
    """
    try:
        return bcrypt.checkpw(
            _validate_password_length(plain_password), password_hash.encode("utf-8")
        )
    except (ValueError, TypeError):
        return False


def _create_token(username: str, token_type: str, expires_delta: timedelta) -> str:
    """签发 JWT。

    参数：
        username: 管理员用户名（Payload.sub）
        token_type: "access" | "refresh"
        expires_delta: 有效期时长
    """
    now = datetime.now(UTC)
    payload = {
        "sub": username,          # 主体：用户名
        "typ": token_type,        # 令牌类型（防止 refresh 被当 access 用）
        "iat": now,               # 签发时间
        "exp": now + expires_delta,  # 过期时间
    }
    # HS256 对称签名（生产环境 JWT_SECRET 必须替换为强随机密钥）
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def create_access_token(username: str) -> str:
    """签发 Access Token（默认 2 小时）。"""
    return _create_token(
        username, "access", timedelta(minutes=settings.JWT_ACCESS_TTL_MINUTES)
    )


def create_refresh_token(username: str) -> str:
    """签发 Refresh Token（默认 14 天）。"""
    return _create_token(
        username, "refresh", timedelta(days=settings.JWT_REFRESH_TTL_DAYS)
    )


def decode_token(token: str) -> dict:
    """校验并解析 JWT，返回 Payload。

    异常：签名无效 / 过期 / 格式错误时抛出 jwt.PyJWTError，
    由调用方（require_admin 依赖）统一转为 401 响应。
    """
    return jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
