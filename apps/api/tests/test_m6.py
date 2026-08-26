# ============================================================================
# HAOYAO 后端：M6 模块测试（改密码 / 仪表盘 / 媒体库 / 网站配置）
# 用例编号：M6-xxx
# 对应《M6_测试用例.md》"账号安全 / 仪表盘 / 媒体库 / 网站配置"模块。
# ============================================================================

from __future__ import annotations

import io

from fastapi.testclient import TestClient

# PNG 最小有效文件头（内容非真实图片，服务器仅校验扩展名与大小）
PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


# ============================================================================
# 改密码（M6-AUTH）
# ============================================================================

def test_change_password_wrong_old(client: TestClient, admin_headers: dict) -> None:
    """M6-AUTH-001：旧密码错误 → 422 / 42200。"""
    resp = client.post(
        "/api/v1/admin/auth/change-password",
        json={"old_password": "wrong-old", "new_password": "NewPass123"},
        headers=admin_headers,
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == 42200


def test_change_password_weak_new(client: TestClient, admin_headers: dict) -> None:
    """M6-AUTH-002：新密码弱（纯数字）→ 422 / 42200。"""
    resp = client.post(
        "/api/v1/admin/auth/change-password",
        json={"old_password": "change-me", "new_password": "1234567890"},
        headers=admin_headers,
    )
    assert resp.status_code == 422


def test_change_password_success_and_relogin(client: TestClient, admin_headers: dict) -> None:
    """M6-AUTH-003：改密成功 → 旧密码失效 / 新密码可登录；审计存在。"""
    resp = client.post(
        "/api/v1/admin/auth/change-password",
        json={"old_password": "change-me", "new_password": "NewPass123"},
        headers=admin_headers,
    )
    assert resp.status_code == 200

    # 旧密码登录失败（新密码已生效）
    resp = client.post(
        "/api/v1/admin/auth/login", json={"username": "admin", "password": "change-me"}
    )
    assert resp.status_code == 401

    # 新密码登录成功
    resp = client.post(
        "/api/v1/admin/auth/login", json={"username": "admin", "password": "NewPass123"}
    )
    assert resp.status_code == 200
    new_token = resp.json()["data"]["access_token"]

    # 改密审计（target_type=admin_password）
    stats = client.get(
        "/api/v1/admin/dashboard/stats",
        headers={"Authorization": f"Bearer {new_token}"},
    )
    audits = stats.json()["data"]["recent_audits"]
    assert any(a["target_type"] == "admin_password" for a in audits)

    # 恢复原密码（避免影响其他用例）
    client.post(
        "/api/v1/admin/auth/change-password",
        json={"old_password": "NewPass123", "new_password": "change-me"},
        headers={"Authorization": f"Bearer {new_token}"},
    )


# ============================================================================
# 仪表盘（M6-DASH）
# ============================================================================

def test_dashboard_stats(client: TestClient, admin_headers: dict) -> None:
    """M6-DASH-001：仪表盘统计 → 6 组结构完整 + 最近审计 8 条。"""
    resp = client.get("/api/v1/admin/dashboard/stats", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert isinstance(data["products"], int)
    assert set(data["categories"].keys()) == {"top", "sub"}
    assert set(data["articles"].keys()) == {"total", "published"}
    assert isinstance(data["banners"], int)
    assert set(data["media"].keys()) == {"total", "images", "videos"}
    assert set(data["translation"].keys()) == {"products_incomplete", "articles_incomplete"}
    assert isinstance(data["recent_audits"], list)
    assert len(data["recent_audits"]) <= 8


# ============================================================================
# 媒体库（M6-MED）
# ============================================================================

def test_media_upload_list_delete(client: TestClient, admin_headers: dict) -> None:
    """M6-MED-001：图片上传 → 列表可见 → 删除。"""
    resp = client.post(
        "/api/v1/admin/media/upload",
        files={"file": ("demo.png", io.BytesIO(PNG_BYTES), "image/png")},
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()["data"]
    assert data["type"] == "image"
    assert data["url"].startswith("http://")
    assert data["url"].endswith(".png")

    # 列表
    listed = client.get("/api/v1/admin/media", headers=admin_headers).json()["data"]
    assert any(m["id"] == data["id"] for m in listed["items"])

    # 删除
    resp = client.delete(f"/api/v1/admin/media/{data['id']}", headers=admin_headers)
    assert resp.status_code == 200
    listed = client.get("/api/v1/admin/media", headers=admin_headers).json()["data"]
    assert all(m["id"] != data["id"] for m in listed["items"])


def test_media_upload_reject_ext(client: TestClient, admin_headers: dict) -> None:
    """M6-MED-002：非法扩展名（.txt）→ 422 / 42200。"""
    resp = client.post(
        "/api/v1/admin/media/upload",
        files={"file": ("evil.txt", io.BytesIO(b"x"), "text/plain")},
        headers=admin_headers,
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == 42200


def test_media_upload_reject_size(client: TestClient, admin_headers: dict) -> None:
    """M6-MED-003：图片超过 10MB → 422 / 42200。"""
    big = b"\x89PNG\r\n\x1a\n" + b"\x00" * (11 * 1024 * 1024)
    resp = client.post(
        "/api/v1/admin/media/upload",
        files={"file": ("big.png", io.BytesIO(big), "image/png")},
        headers=admin_headers,
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == 42200


# ============================================================================
# 网站配置（M6-CFG）
# ============================================================================

def test_banner_crud(client: TestClient, admin_headers: dict) -> None:
    """M6-CFG-001：banner CRUD 全流程。"""
    # 创建
    resp = client.post(
        "/api/v1/admin/banners",
        json={
            "image_url": "https://cdn.haoyao.com/media/banner-new.webp",
            "title": {"zh": "新轮播", "en": "New Banner"},
            "link_type": "url",
            "link_value": "https://www.haoyao.com",
            "sort": 5,
            "enabled": True,
        },
        headers=admin_headers,
    )
    assert resp.status_code == 201
    bid = resp.json()["data"]["id"]

    # 列表
    listed = client.get("/api/v1/admin/banners", headers=admin_headers).json()["data"]
    assert any(b["id"] == bid for b in listed)

    # 修改
    resp = client.put(
        f"/api/v1/admin/banners/{bid}",
        json={
            "image_url": "https://cdn.haoyao.com/media/banner-v2.webp",
            "title": {"zh": "新轮播2", "en": "Banner 2"},
            "link_type": "url",
            "link_value": "",
            "sort": 6,
            "enabled": False,
        },
        headers=admin_headers,
    )
    assert resp.status_code == 200

    # 删除
    resp = client.delete(f"/api/v1/admin/banners/{bid}", headers=admin_headers)
    assert resp.status_code == 200


def test_site_config_get_update(client: TestClient, admin_headers: dict) -> None:
    """M6-CFG-002：site-config 聚合读 + 部分更新（switches/featured_products）。"""
    # 读取：4 键结构完整
    resp = client.get("/api/v1/admin/site-config", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert set(data.keys()) == {"contact", "seo", "switches", "featured_products"}

    # 部分更新：switches + featured_products（有序列表）
    resp = client.put(
        "/api/v1/admin/site-config",
        json={
            "switches": {"show_price": False, "show_new_tag": True},
            "featured_products": [5, 3],
        },
        headers=admin_headers,
    )
    assert resp.status_code == 200

    # 读回：仅提交的键变化，contact 保持原值
    data = client.get("/api/v1/admin/site-config", headers=admin_headers).json()["data"]
    assert data["switches"]["show_price"] is False
    assert data["featured_products"] == [5, 3]
    assert isinstance(data["contact"], dict)
