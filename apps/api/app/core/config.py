# ============================================================================
# HAOYAO 后端：应用配置层
# 功能：基于 pydantic-settings 读取环境变量（.env / 环境变量），
#       统一管理数据库、JWT、管理员、CORS、revalidate 等配置项。
# 依据：《HAOYAO_官网_开发技术文档.md》§3.5 环境变量清单
# ============================================================================

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """应用配置类（环境变量驱动）。

    所有配置项均有开发默认值；生产环境通过 .env / Docker Secret 注入覆盖。
    字段命名与《开发技术文档》§3.5 环境变量清单保持一致。
    """

    model_config = SettingsConfigDict(
        # 读取项目根 .env 文件（仅本地开发；生产用真实环境变量）
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ---------- 通用 ----------
    # 运行环境：development | production
    ENVIRONMENT: str = "development"
    # 应用时区（仅展示层使用，存储一律 UTC）
    APP_TIMEZONE: str = "Asia/Shanghai"

    # ---------- 数据库 ----------
    # SQLite 连接串；开发默认落在 apps/api 运行目录下
    DATABASE_URL: str = "sqlite:///./haoyao.db"

    # ---------- JWT 认证 ----------
    # 生产必须替换为强随机 64 位密钥
    JWT_SECRET: str = "change-me-in-production"
    # Access Token 有效期（分钟）
    JWT_ACCESS_TTL_MINUTES: int = 120
    # Refresh Token 有效期（天）
    JWT_REFRESH_TTL_DAYS: int = 14

    # ---------- 管理员（首启自动创建） ----------
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD_INIT: str = "change-me"

    # ---------- 登录限流 ----------
    # 连续失败次数阈值
    LOGIN_MAX_FAILURES: int = 5
    # 锁定分钟数
    LOGIN_LOCK_MINUTES: int = 15

    # ---------- CORS ----------
    # 允许的跨域来源（逗号分隔）；开发默认前台地址
    CORS_ORIGINS: str = "http://localhost:3000"

    # ---------- ISR revalidate 通知（后端 → Next.js） ----------
    # Next.js 内部地址；Docker 内为 http://web:3000
    NEXTJS_INTERNAL_BASE: str = "http://localhost:3000"
    # 内部接口调用密钥（与 Next.js 侧 ADMIN_API_KEY 一致）
    ADMIN_API_KEY: str = "revalidate-secret"

    @property
    def cors_origins_list(self) -> list[str]:
        """将逗号分隔的 CORS 白名单解析为列表（供 CORSMiddleware 使用）。"""
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    """返回全局单例配置（lru_cache 缓存，避免每次请求重复解析环境变量）。"""
    return Settings()


# 模块级默认实例：业务层直接引用 settings 即可
settings = get_settings()
