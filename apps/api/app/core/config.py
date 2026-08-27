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

    # ---------- 媒体库（M6，本地模拟存储 / M8 对象存储） ----------
    # 存储后端：local（本地 uploads/ 目录，开发默认）| cos（腾讯云 COS 预签名直传，生产）
    UPLOAD_BACKEND: str = "local"
    # 上传文件保存目录（相对运行目录 apps/api；Docker 挂载卷覆盖）
    UPLOAD_DIR: str = "uploads"
    # 媒体访问基础 URL（本地开发直连后端；生产替换为 CDN 域名）
    MEDIA_BASE_URL: str = "http://localhost:8000/uploads"
    # 上传大小限制（字节）：图片 10MB / 视频 200MB（PRD §5.6 / 技术文档 §5.7）
    MAX_IMAGE_SIZE: int = 10 * 1024 * 1024
    MAX_VIDEO_SIZE: int = 200 * 1024 * 1024

    # ---------- 对象存储（M8：UPLOAD_BACKEND=cos 时启用，腾讯云 COS） ----------
    # 密钥（生产从环境变量/密钥管理注入，勿硬编码）
    COS_SECRET_ID: str = ""
    COS_SECRET_KEY: str = ""
    # COS 地域（如 ap-shanghai）
    COS_REGION: str = "ap-shanghai"
    # 存储桶名称（含 appid，如 haoyao-1250000000）
    COS_BUCKET: str = ""
    # 预签名 URL 有效期（秒）
    COS_PRESIGN_TTL: int = 600

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
