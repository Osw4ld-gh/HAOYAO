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

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from ...core.config import settings
from ...core.db import get_db
from ...core.deps import require_admin
from ...core.errors import validation
from ...models import MediaAsset
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

    # 3) 落盘：uploads/{uuid}{ext}（目录不存在则创建）
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{ext}"
    (upload_dir / filename).write_bytes(content)

    # 4) 登记元数据
    asset = MediaAsset(
        filename=file.filename or filename,
        url=f"{settings.MEDIA_BASE_URL}/{filename}",
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
