# ============================================================================
# HAOYAO 后端：媒体库路由（上传 / 列表 / 删除）
# 功能：
#   - POST /admin/media/upload    上传（multipart：图片≤10MB / 视频≤200MB）
#   - GET  /admin/media           媒体列表（分页 + 类型过滤）
#   - DELETE /admin/media/{id}    删除（记录 + 本地文件）
# 依据：PRD §5.6 媒体库 / 技术文档 §5.7（本地模拟存储实现）：
#   - 校验：扩展名白名单（图片 jpg/jpeg/png/webp/gif；视频 mp4/webm/mov）+ 大小上限
#   - 存储：UPLOAD_DIR/{uuid}.{ext}，登记 media_asset 元数据，URL 由 MEDIA_BASE_URL 拼接
#   - 生产切换：对象存储预签名（M8），本接口为本地模拟通道
# ============================================================================

# mypy: disable-error-code="no-untyped-def"
# 说明：FastAPI 路由返回类型由 OpenAPI 自动处理，故豁免该规则。

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, File, Query, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ...core.config import settings
from ...core.db import get_db
from ...core.deps import require_admin
from ...core.errors import validation
from ...models import MediaAsset
from ...services.storage import storage
from ...utils.audit import write_audit
from ...utils.pagination import DEFAULT_PAGE_SIZE_ADMIN, MAX_PAGE_SIZE, normalize_page, paginate
from ...utils.response import ok

router = APIRouter(prefix="/media", tags=["admin-media"])

# 扩展名 → 类型映射（白名单）
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
VIDEO_EXTS = {".mp4", ".webm", ".mov"}


@router.post("/upload", status_code=201)
def upload_media(
    file: UploadFile = File(...),
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """上传媒体文件（本地模拟存储）。

    校验顺序：扩展名白名单 → 大小上限（图片 10MB / 视频 200MB）。
    存储：UPLOAD_DIR/{uuid}{ext}；登记 media_asset（url 为 MEDIA_BASE_URL 拼接）。
    """
    # 1) 扩展名白名单（大小写不敏感）
    ext = Path(file.filename or "").suffix.lower()
    media_type = None
    if ext in IMAGE_EXTS:
        media_type = "image"
    elif ext in VIDEO_EXTS:
        media_type = "video"
    else:
        raise validation("仅支持图片（jpg/png/webp/gif）或视频（mp4/webm/mov）")

    # 2) 读取并校验大小
    content = file.file.read()
    max_size = settings.MAX_IMAGE_SIZE if media_type == "image" else settings.MAX_VIDEO_SIZE
    if len(content) > max_size:
        limit_mb = max_size // (1024 * 1024)
        raise validation(f"文件超过大小限制（{media_type} ≤ {limit_mb}MB）")

    # 3) 生成存储键并保存（local：落盘 uploads/；cos：服务端不落盘，返回 CDN URL 占位）
    object_key, _ = storage.generate_key(file.filename or "upload")
    url = storage.save(object_key, content)

    # 4) 登记元数据
    asset = MediaAsset(
        filename=file.filename or object_key,
        url=url,
        type=media_type,
        size=len(content),
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)

    write_audit(db, operator, "create", "media", asset.id, {"filename": file.filename})

    return ok(
        {
            "id": asset.id,
            "url": asset.url,
            "type": asset.type,
            "size": asset.size,
            "filename": asset.filename,
        },
        message="上传成功",
    )


@router.get("")
def list_media(
    media_type: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(DEFAULT_PAGE_SIZE_ADMIN, ge=1, le=MAX_PAGE_SIZE),
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """媒体列表（分页 + 类型过滤，时间倒序）。"""
    query = select(MediaAsset).order_by(MediaAsset.created_at.desc(), MediaAsset.id.desc())
    if media_type in ("image", "video"):
        query = query.where(MediaAsset.type == media_type)

    page, page_size = normalize_page(page, page_size, DEFAULT_PAGE_SIZE_ADMIN)
    result = paginate(db, query, page, page_size)

    items = [
        {
            "id": m.id,
            "filename": m.filename,
            "url": m.url,
            "type": m.type,
            "size": m.size,
            "created_at": m.created_at,
        }
        for m in result["items"]
    ]
    return ok(
        {
            "total": result["total"],
            "page": result["page"],
            "page_size": result["page_size"],
            "items": items,
        }
    )


@router.delete("/{media_id}")
def delete_media(
    media_id: int,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """删除媒体：删除记录 + 删除本地文件。

    说明：记录删除不校验引用（引用悬空由运营流程保证，数据库文档 §4.13）。
    """
    from ...core.errors import not_found

    asset = db.get(MediaAsset, media_id)
    if asset is None:
        raise not_found("媒体资源不存在")

    # 删除本地文件（尽力而为：文件缺失不阻塞记录删除）
    try:
        local = Path(settings.UPLOAD_DIR) / asset.url.rsplit("/", 1)[-1]
        if local.exists():
            local.unlink()
    except OSError:
        pass

    db.delete(asset)
    db.commit()

    write_audit(db, operator, "delete", "media", media_id, {"filename": asset.filename})
    return ok(None, message="删除成功")


# ============================================================================
# 对象存储预签名（M8：UPLOAD_BACKEND=cos 时启用）
# ============================================================================

class PresignBody(BaseModel):
    """预签名请求体：文件名（校验扩展名白名单）。"""

    filename: str = Field(..., min_length=1, max_length=255)


class ConfirmBody(BaseModel):
    """上传完成登记请求体：客户端 PUT 直传完成后回调。"""

    object_key: str = Field(..., min_length=1, max_length=512)
    size: int = Field(..., ge=0)
    filename: str = Field(default="", max_length=255)


@router.post("/presign")
def presign_upload(
    body: PresignBody,
    operator: str = Depends(require_admin),
):
    """生成预签名 PUT URL（cos 模式）。

    local 模式：不支持预签名，返回 42200 提示走 /upload 直传。
    """
    if settings.UPLOAD_BACKEND != "cos":
        raise validation("当前为本地存储模式，请直接使用 /upload")

    try:
        object_key, media_type = storage.generate_key(body.filename)
    except ValueError:
        raise validation("仅支持图片（jpg/png/webp/gif）或视频（mp4/webm/mov）") from None
    upload_url = storage.presign_upload(object_key)
    if upload_url is None:
        raise validation("预签名生成失败")

    return ok(
        {
            "object_key": object_key,
            "upload_url": upload_url,
            "url": storage.public_url(object_key),
            "expires_in": settings.COS_PRESIGN_TTL,
            "type": media_type,
        },
        message="预签名已生成，请在有效期内直传",
    )


@router.post("/confirm", status_code=201)
def confirm_upload(
    body: ConfirmBody,
    operator: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """登记已上传的对象（cos 模式客户端直传完成后调用）。

    说明：服务端不读取文件内容，仅按客户端上报大小登记元数据；
    media_type 由 object_key 扩展名推断（白名单校验）。
    """
    ext = Path(body.object_key).suffix.lower()
    media_type = "image" if ext in IMAGE_EXTS else "video" if ext in VIDEO_EXTS else None
    if media_type is None:
        raise validation("仅支持图片（jpg/png/webp/gif）或视频（mp4/webm/mov）")

    asset = MediaAsset(
        filename=body.filename or body.object_key,
        url=storage.public_url(body.object_key),
        type=media_type,
        size=body.size,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)

    write_audit(db, operator, "create", "media", asset.id, {"object_key": body.object_key})
    return ok(
        {"id": asset.id, "url": asset.url, "type": asset.type, "size": asset.size},
        message="上传完成",
    )
