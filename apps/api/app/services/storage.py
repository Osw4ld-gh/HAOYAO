# ============================================================================
# HAOYAO 后端：媒体存储抽象（M8）
# 功能：统一媒体文件上传/登记接口，按 UPLOAD_BACKEND 环境变量切换后端：
#   - local：文件直传落盘 uploads/ 目录（开发默认，M6 已有逻辑迁移至此）
#   - cos：腾讯云 COS 预签名直传（客户端 PUT 到预签名 URL + 回调登记）
# 依据：技术文档 §5.7（本地模拟存储 → 对象存储预签名）：
#   - 生产环境 UPLOAD_BACKEND=cos 时启用 COS 预签名，CDN 域名由 MEDIA_BASE_URL 提供
#   - COS 预签名使用标准 V5 签名（HmacSHA1），无需额外 SDK 依赖
# ============================================================================

from __future__ import annotations

import hashlib
import hmac
import time
import uuid
from pathlib import Path
from typing import Protocol

from ..core.config import settings

# 扩展名 → 类型映射（白名单，与 M6 媒体路由共用）
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
VIDEO_EXTS = {".mp4", ".webm", ".mov"}


class StorageBackend(Protocol):
    """媒体存储后端协议。

    - generate_key(filename) -> (object_key, media_type)：生成存储键（uuid+ext）
    - presign_upload(object_key) -> str | None：返回预签名 PUT URL（local 后端返回 None）
    - save(object_key, content) -> str：保存文件并返回可访问 URL（local 后端用）
    - public_url(object_key) -> str：拼接 MEDIA_BASE_URL + object_key
    """

    def generate_key(self, filename: str) -> tuple[str, str]:
        """生成 object_key（media/{uuid}.{ext}）与媒体类型（image/video）。"""
        ext = Path(filename).suffix.lower()
        if ext in IMAGE_EXTS:
            media_type = "image"
        elif ext in VIDEO_EXTS:
            media_type = "video"
        else:
            raise ValueError("unsupported extension")
        return f"media/{uuid.uuid4().hex}{ext}", media_type

    def presign_upload(self, object_key: str) -> str | None:
        """返回客户端直传预签名 URL；不支持时返回 None（走服务端 save）。"""
        raise NotImplementedError

    def save(self, object_key: str, content: bytes) -> str:
        """保存文件并返回可访问 URL。"""
        raise NotImplementedError

    def public_url(self, object_key: str) -> str:
        """拼接 MEDIA_BASE_URL + object_key。"""
        return f"{settings.MEDIA_BASE_URL.rstrip('/')}/{object_key}"


class LocalStorageBackend:
    """本地存储：文件落盘 uploads/ 目录（M6 行为，M8 迁入抽象）。"""

    def generate_key(self, filename: str) -> tuple[str, str]:
        ext = Path(filename).suffix.lower()
        if ext in IMAGE_EXTS:
            media_type = "image"
        elif ext in VIDEO_EXTS:
            media_type = "video"
        else:
            raise ValueError("unsupported extension")
        return f"media/{uuid.uuid4().hex}{ext}", media_type

    def presign_upload(self, object_key: str) -> str | None:
        # 本地模式无需预签名（服务端直接收文件）
        return None

    def save(self, object_key: str, content: bytes) -> str:
        upload_dir = Path(settings.UPLOAD_DIR)
        # 确保 uploads/media/ 等子目录存在（object_key 含路径前缀）
        (upload_dir / object_key).parent.mkdir(parents=True, exist_ok=True)
        (upload_dir / object_key).write_bytes(content)
        return self.public_url(object_key)

    def public_url(self, object_key: str) -> str:
        return f"{settings.MEDIA_BASE_URL.rstrip('/')}/{object_key}"


class CosStorageBackend:
    """腾讯云 COS 存储：预签名直传（客户端 PUT），生产模式。

    签名实现：COS V5 签名（HmacSHA1），无需 SDK。
    - presign_upload：生成 media/{uuid}.{ext} 的 PUT 预签名 URL（有效期 COS_PRESIGN_TTL）
    - save：不适用（客户端直传），返回 public_url（CDN 域名）
    """

    def generate_key(self, filename: str) -> tuple[str, str]:
        ext = Path(filename).suffix.lower()
        if ext in IMAGE_EXTS:
            media_type = "image"
        elif ext in VIDEO_EXTS:
            media_type = "video"
        else:
            raise ValueError("unsupported extension")
        return f"media/{uuid.uuid4().hex}{ext}", media_type

    def presign_upload(self, object_key: str) -> str | None:
        """生成 COS PUT 预签名 URL（V5 签名，有效期 COS_PRESIGN_TTL 秒）。"""
        if not settings.COS_SECRET_ID or not settings.COS_SECRET_KEY:
            raise RuntimeError("COS credentials not configured")
        if not settings.COS_BUCKET:
            raise RuntimeError("COS_BUCKET not configured")

        now = int(time.time())
        key_time = f"{now};{now + settings.COS_PRESIGN_TTL}"
        # 签名密钥：HMAC-SHA1(SecretKey, KeyTime)
        sign_key = hmac.new(
            settings.COS_SECRET_KEY.encode(), key_time.encode(), hashlib.sha1
        ).hexdigest()
        # 签名内容：PUT 方法 + bucket-host + object 路径 + 空参数串 + 空头部串
        bucket_host = f"{settings.COS_BUCKET}.cos.{settings.COS_REGION}.myqcloud.com"
        http_string = f"put\n/{object_key}\n\n\n"
        string_to_sign = f"sha1\n{key_time}\n{hashlib.sha1(http_string.encode()).hexdigest()}\n"
        signature = hmac.new(
            sign_key.encode(), string_to_sign.encode(), hashlib.sha1
        ).hexdigest()

        q_key_time = _quote(key_time)
        q_signature = _quote(signature)
        auth = (
            f"q-sign-algorithm=sha1&q-ak={settings.COS_SECRET_ID}"
            f"&q-sign-time={q_key_time}&q-key-time={q_key_time}"
            f"&q-header-list=&q-url-param-list=&q-signature={q_signature}"
        )
        return f"https://{bucket_host}/{object_key}?{auth}"

    def save(self, object_key: str, content: bytes) -> str:
        # COS 模式下客户端直传，服务端不落盘；返回 CDN URL
        return self.public_url(object_key)

    def public_url(self, object_key: str) -> str:
        return f"{settings.MEDIA_BASE_URL.rstrip('/')}/{object_key}"


def _quote(value: str) -> str:
    """URL 安全编码（RFC 3986 保留字符，COS 签名要求）。"""
    from urllib.parse import quote

    return quote(value, safe="")


def get_storage() -> StorageBackend:
    """按 UPLOAD_BACKEND 返回存储后端实例。"""
    if settings.UPLOAD_BACKEND == "cos":
        return CosStorageBackend()
    return LocalStorageBackend()


# 模块级单例（避免每次请求重建）
storage = get_storage()
