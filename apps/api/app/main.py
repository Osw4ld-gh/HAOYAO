# ============================================================================
# HAOYAO 后端：应用入口
# 功能：FastAPI 应用装配 —— CORS、日志中间件、全局异常处理、
#       启动时数据库初始化（lifespan）、路由注册。
# 依据：《HAOYAO_官网_开发技术文档.md》§5.1 / §5.9：
#   - CORS 白名单来自 CORS_ORIGINS
#   - 结构化日志（json）：method/path/status/duration
#   - RequestValidationError → 40000；未捕获异常 → 50000
#   - /docs 由 FastAPI 自动生成（OpenAPI 骨架）
# ============================================================================

from __future__ import annotations

import json
import logging
import time
from collections.abc import AsyncIterator, Awaitable, Callable, Sequence
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .core.errors import BizError
from .core.init_db import init_db
from .routers.admin import admin_router
from .routers.public import public_router
from .routers.public.health import router as health_router
from .utils.response import fail

# 结构化日志器：JSON 输出，便于采集平台（腾讯云 CLS 等）解析
logger = logging.getLogger("haoyao.api")
logging.basicConfig(level=logging.INFO, format="%(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """应用生命周期：启动时执行数据库初始化（幂等）。

    说明：首次启动建表 + 种子 + 管理员；后续启动仅确保管理员就绪。
    """
    logger.info(json.dumps({"event": "startup", "env": settings.ENVIRONMENT}))
    init_db()
    yield
    logger.info(json.dumps({"event": "shutdown"}))


app = FastAPI(
    title="HAOYAO API",
    description="HAOYAO（皓遥）官网后端 API（前台读接口 + 后台管理接口）",
    version="0.1.0",
    lifespan=lifespan,
    # OpenAPI 契约路径：/docs（Swagger UI）/ openapi.json
)

# ---------- CORS：跨域白名单 ----------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """HTTP 访问日志中间件（结构化 JSON）。

    记录：method / path / status / duration_ms；
    慢请求与 5xx 可通过采集平台据此告警。
    """
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = round((time.perf_counter() - start) * 1000, 2)
    logger.info(
        json.dumps(
            {
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "duration_ms": duration_ms,
            },
            ensure_ascii=False,
        )
    )
    return response


# ---------- 全局异常处理 ----------

@app.exception_handler(BizError)
async def biz_error_handler(request: Request, exc: BizError) -> Response:
    """业务异常 → 统一响应包（业务 code + HTTP 状态码）。

    说明：路由层抛出 BizError（40100/40400/40900/42200 等）时，
    统一转为 {code, message, data: null} 结构，HTTP 状态码表达传输层语义。
    """
    logger.info(
        json.dumps(
            {
                "event": "biz_error",
                "path": request.url.path,
                "code": exc.code,
                "message": exc.message,
            },
            ensure_ascii=False,
        )
    )
    return fail(exc.code, exc.message, status_code=exc.status_code)


def _clean_validation_errors(errors: Sequence[Any]) -> list:
    """净化 Pydantic 校验错误列表，保证 JSON 可序列化。

    说明：Pydantic v2 的 field_validator 错误 ctx.error 可能携带异常对象，
    json.dumps 无法序列化，需转为字符串。
    """
    cleaned = []
    for err in errors:
        item = dict(err)
        ctx = item.get("ctx")
        if isinstance(ctx, dict) and "error" in ctx:
            item["ctx"] = {**ctx, "error": str(ctx["error"])}
        cleaned.append(item)
    return cleaned


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> Response:
    """请求参数校验失败 → 40000（HTTP 400）。

    说明：FastAPI/Pydantic 的默认校验错误对前端不友好，
    统一收敛为业务错误码（技术文档 §5.9）。
    """
    logger.warning(
        json.dumps(
            {
                "event": "validation_error",
                "path": request.url.path,
                "errors": _clean_validation_errors(exc.errors()),
            },
            ensure_ascii=False,
        )
    )
    return fail(40000, "参数校验失败", status_code=400)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> Response:
    """未捕获异常 → 50000（HTTP 500）。

    说明：服务端记录完整堆栈，客户端仅收到统一错误结构，不泄露内部细节。
    """
    logger.exception(json.dumps({"event": "unhandled_error", "path": request.url.path}))
    return fail(50000, "服务器内部错误", status_code=500)


# ---------- 路由注册 ----------
# 健康检查：注册在根路径（无 /api/v1 前缀，供探针直接访问）
app.include_router(health_router)
# 后台路由（M2）：统一前缀 /api/v1/admin
app.include_router(admin_router, prefix="/api/v1")
# 前台公开路由（M3）：/api/v1/navigation、/categories、/home、/products
app.include_router(public_router, prefix="/api/v1")
