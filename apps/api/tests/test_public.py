# ============================================================================
# HAOYAO 后端：前台公开接口测试
# 用例编号：M3-PUB-xxx
# 对应《M3_测试用例.md》"前台公开接口"模块：
#   - 导航（仅启用）/ 分类树 / 首页聚合 / 产品列表（过滤+仅上架）/ 产品详情（404 语义）
# ============================================================================

from __future__ import annotations

from fastapi.testclient import TestClient


def _create_product(
    client: TestClient,
    headers: dict,
    *,
    ref_code: str,
    name_zh: str,
    is_new: bool = False,
    status: str = "on",
    sub_id: int = 10,
) -> int:
    """辅助：通过后台接口创建产品并返回 id。"""
    resp = client.post(
        "/api/v1/admin/products",
        json={
            "sub_id": sub_id,
            "name": {"zh": name_zh, "en": f"EN-{name_zh}"},
            "ref_code": ref_code,
            "price": 128000,
            "desc": {"zh": "d", "en": "d"},
            "ingredients": {"zh": "i", "en": "i"},
            "usage": {"zh": "u", "en": "u"},
            "variants": [],
            "is_new": is_new,
            "status": status,
            "sort": 0,
            "images": [{"url": f"https://cdn.haoyao.com/media/{ref_code}.webp", "is_cover": True}],
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["data"]["id"]


# ============================================================================
# 导航（M3-PUB-NAV）
# ============================================================================

def test_public_navigation_tree(client: TestClient) -> None:
    """M3-PUB-001：前台导航树 → 6 顶层（含启用过滤）+ 二级 children。"""
    resp = client.get("/api/v1/navigation")
    assert resp.status_code == 200
    items = resp.json()["data"]
    assert len(items) == 6
    fragrance = next(n for n in items if n["link_value"] == "fragrance")
    assert len(fragrance["children"]) == 2  # women / men
    # 前台结构：无 enabled 字段（仅返回启用项）
    assert "enabled" not in items[0]


def test_public_navigation_disabled_hidden(client: TestClient, admin_headers: dict) -> None:
    """M3-PUB-002：停用导航后前台不再返回。"""
    # 停用首页导航（id=1）
    resp = client.put(
        "/api/v1/admin/navigation/1/toggle", json={"enabled": False}, headers=admin_headers
    )
    assert resp.status_code == 200
    items = client.get("/api/v1/navigation").json()["data"]
    assert all(n["id"] != 1 for n in items)


# ============================================================================
# 分类树（M3-PUB-CAT）
# ============================================================================

def test_public_categories_tree(client: TestClient) -> None:
    """M3-PUB-003：分类树 → 3 顶层 + 各含二级（slug/双语名称）。"""
    resp = client.get("/api/v1/categories")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 3
    skincare = next(c for c in data if c["slug"] == "skincare")
    serum = next(s for s in skincare["children"] if s["slug"] == "serum")
    assert serum["name"] == {"zh": "精华", "en": "Serums"}


# ============================================================================
# 首页聚合（M3-PUB-HOME）
# ============================================================================

def test_public_home_empty_db(client: TestClient) -> None:
    """M3-PUB-004：空产品库首页聚合 → 四组结构完整（空列表 + 1 banner + 1 资讯）。"""
    resp = client.get("/api/v1/home")
    assert resp.status_code == 200
    data = resp.json()["data"]
    # 种子含 1 个启用 banner
    assert len(data["banners"]) >= 1
    assert data["banners"][0]["title"]["zh"]
    assert data["new_products"] == []
    assert data["featured_products"] == []
    # 种子含 1 篇已发布资讯
    assert len(data["latest_articles"]) == 1
    assert data["latest_articles"][0]["category"] in ("company", "industry")


def test_public_home_with_products(client: TestClient, admin_headers: dict) -> None:
    """M3-PUB-005：有产品后首页聚合 → 新品/明星位按规则输出。"""
    pid = _create_product(
        client, admin_headers, ref_code="HY-HOME-01", name_zh="新品精华", is_new=True
    )
    resp = client.get("/api/v1/home")
    data = resp.json()["data"]
    new_ids = [p["id"] for p in data["new_products"]]
    assert pid in new_ids
    # 新品卡片结构（技术文档 §6.4.2 产品卡片 + top_slug 增强字段）
    card = next(p for p in data["new_products"] if p["id"] == pid)
    expected_keys = {"id", "name", "ref_code", "price", "is_new", "cover_image", "top_slug"}
    assert set(card.keys()) == expected_keys
    assert card["top_slug"] == "skincare"


# ============================================================================
# 产品列表（M3-PUB-LIST）
# ============================================================================

def test_public_products_filter(client: TestClient, admin_headers: dict) -> None:
    """M3-PUB-006：列表过滤（top_slug/sub_slug/is_new）+ 仅上架。"""
    on_id = _create_product(
        client, admin_headers, ref_code="HY-LIST-ON", name_zh="上架品", sub_id=10
    )
    off_id = _create_product(
        client,
        admin_headers,
        ref_code="HY-LIST-OFF",
        name_zh="下架品",
        sub_id=10,
        status="off",
    )

    # 顶层过滤（skincare，含 serum）
    resp = client.get("/api/v1/products?top_slug=skincare")
    items = resp.json()["data"]["items"]
    assert on_id in [p["id"] for p in items]
    assert off_id not in [p["id"] for p in items]  # 下架不可见

    # 二级过滤（serum）
    resp = client.get("/api/v1/products?top_slug=skincare&sub_slug=serum")
    assert resp.json()["data"]["total"] >= 1

    # 新品过滤
    resp = client.get("/api/v1/products?is_new=true")
    assert isinstance(resp.json()["data"]["total"], int)

    # 不存在的顶层 → 空结果（不报错）
    resp = client.get("/api/v1/products?top_slug=not-exist")
    assert resp.json()["data"]["total"] == 0


def test_public_products_pagination(client: TestClient, admin_headers: dict) -> None:
    """M3-PUB-007：分页默认 12/页，结构 total/page/page_size/items。"""
    resp = client.get("/api/v1/products")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert set(data.keys()) == {"total", "page", "page_size", "items"}
    assert data["page_size"] == 12  # 前台默认分页大小


# ============================================================================
# 产品详情（M3-PUB-DETAIL）
# ============================================================================

def test_public_product_detail(client: TestClient, admin_headers: dict) -> None:
    """M3-PUB-008：详情结构（images/variants/related/sub_category）。"""
    pid = _create_product(
        client, admin_headers, ref_code="HY-DETAIL-1", name_zh="详情品", sub_id=10
    )
    resp = client.get(f"/api/v1/products/{pid}")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["name"]["zh"] == "详情品"
    assert len(data["images"]) == 1
    assert data["images"][0]["is_cover"] is True
    assert data["sub_category"]["slug"] == "serum"
    assert data["sub_category"]["top_slug"] == "skincare"
    assert isinstance(data["related"], list)
    assert isinstance(data["variants"], list)


def test_public_product_detail_off_404(client: TestClient, admin_headers: dict) -> None:
    """M3-PUB-009：下架产品详情 → 404 / 40400（前台不可见）。"""
    pid = _create_product(
        client, admin_headers, ref_code="HY-OFF-404", name_zh="下架详情", status="off"
    )
    resp = client.get(f"/api/v1/products/{pid}")
    assert resp.status_code == 404
    assert resp.json()["code"] == 40400


def test_public_product_detail_missing_404(client: TestClient) -> None:
    """M3-PUB-010：不存在产品 → 404 / 40400。"""
    resp = client.get("/api/v1/products/99999")
    assert resp.status_code == 404
    assert resp.json()["code"] == 40400
