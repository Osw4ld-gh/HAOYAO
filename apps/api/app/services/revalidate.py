# ============================================================================
# HAOYAO 后端：ISR revalidate 通知服务
# 功能：后台写操作完成后调用 Next.js 内部接口 /api/revalidate 主动刷新缓存。
# 依据：《HAOYAO_官网_开发技术文档.md》§5.7：
#   - 请求头 x-admin-key 与 ADMIN_API_KEY 一致（Next.js 侧鉴权）
#   - tags 映射：产品/分类→products；导航/配置→home,nav,site；资讯→articles；故事/时间轴→about
# 说明：使用同步 httpx.Client（写路由在 FastAPI 线程池执行，避免事件循环嵌套）；
#       失败仅记日志不抛错（缓存刷新非关键路径，不影响写操作成功返回）。
# ============================================================================

from __future__ import annotations

import logging

import httpx

from ..core.config import settings

logger = logging.getLogger("haoyao.api")

# 超时：Next.js 刷新缓存应在 5s 内完成，超时视为失败
_REVALIDATE_TIMEOUT = 5.0


def notify_revalidate(tags: list[str]) -> None:
    """通知 Next.js 刷新指定 tag 的 ISR 缓存。

    参数：
        tags: 缓存 tag 列表（products / nav / home / site / articles / about）
    """
    if not tags:
        return
    try:
        with httpx.Client(timeout=_REVALIDATE_TIMEOUT) as client:
            resp = client.post(
                f"{settings.NEXTJS_INTERNAL_BASE}/api/revalidate",
                json={"tags": tags},
                headers={"x-admin-key": settings.ADMIN_API_KEY},
            )
            # 非 2xx 视为刷新失败（记录日志，不抛错）
            if resp.status_code >= 400:
                logger.warning(
                    "revalidate failed: status=%s tags=%s", resp.status_code, tags
                )
    except httpx.HTTPError as exc:
        # 网络错误/超时：仅记日志（Next.js 未启动时后台 CRUD 不应受影响）
        logger.warning("revalidate error: %s tags=%s", exc, tags)
