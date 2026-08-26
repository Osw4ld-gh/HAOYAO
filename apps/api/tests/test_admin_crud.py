# ============================================================================
# HAOYAO 后端：导航/分类/产品后台 CRUD 与边界测试
# 用例编号：M2-NAV-xxx / M2-CAT-xxx / M2-PROD-xxx
# 对应《M2_测试用例.md》"导航 CRUD"、"分类 CRUD"、"产品 CRUD"模块
# ============================================================================

from __future__ import annotations

from fastapi.testclient import TestClient

# 复用的产品创建体（sub_id=10 为种子中 serum 精华）
PRODUCT_PAYLOAD = {
    "sub_id": 10,
    "name": {"zh": "焕颜精华", "en": "Radiance Serum"},
    "ref_code": "HY-SK-T001",
    "price": 128000,
    "desc": {"zh": "测试描述", "en": "Test desc"},
    "ingredients": {"zh": "测试成分", "en": "Test ingredients"},
    "usage": {"zh": "测试用法", "en": "Test usage"},
    "variants": [{"name": {"zh": "豆沙", "en": "Rosewood"}, "image_url": "https://cdn.haoyao.com/media/v1.webp"}],
    "is_new": True,
    "status": "on",
    "sort": 10,
    "images": [
        {"url": "https://cdn.haoyao.com/media/p1.webp", "is_cover": True},
        {"url": "https://cdn.haoyao.com/media/p2.webp", "is_cover": False},
    ],
}


def _create_product(client: TestClient, headers: dict, ref_code: str = "HY-SK-T001") -> int:
    """辅助：创建产品并返回 id。"""
    payload = dict(PRODUCT_PAYLOAD)
    payload["ref_code"] = ref_code
    resp = client.post("/api/v1/admin/products", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()["data"]["id"]


# ============================================================================
# 导航 CRUD（M2-NAV）
# ============================================================================

def test_navigation_tree(client: TestClient, admin_headers: dict) -> None:
    """M2-NAV-001：导航树列表 → 6 顶层 + 5 二级（种子数据）。"""
    resp = client.get("/api/v1/admin/navigation", headers=admin_headers)
    assert resp.status_code == 200
    items = resp.json()["data"]
    # 6 个顶层
    assert len(items) == 6
    # 顶层含 children 的（香水 2 个、关于 3 个）
    children_count = sum(len(n["children"]) for n in items)
    assert children_count == 5
    # 双语 label 结构
    assert items[1]["label"]["zh"] == "香水"
    assert items[1]["label"]["en"] == "Fragrance"


def test_navigation_create(client: TestClient, admin_headers: dict) -> None:
    """M2-NAV-002：新增导航（顶层）→ 201 + 树中出现。"""
    resp = client.post(
        "/api/v1/admin/navigation",
        json={
            "parent_id": None,
            "label": {"zh": "测试导航", "en": "Test Nav"},
            "link_type": "url",
            "link_value": "https://example.com",
            "sort": 99,
            "enabled": True,
        },
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text
    nav_id = resp.json()["data"]["id"]

    tree = client.get("/api/v1/admin/navigation", headers=admin_headers).json()["data"]
    assert any(n["id"] == nav_id and n["label"]["zh"] == "测试导航" for n in tree)


def test_navigation_create_child(client: TestClient, admin_headers: dict) -> None:
    """M2-NAV-003：新增子导航（挂到香水 id=2）→ 201。"""
    resp = client.post(
        "/api/v1/admin/navigation",
        json={
            "parent_id": 2,
            "label": {"zh": "子项", "en": "Child"},
            "link_type": "category",
            "link_value": "fragrance/women",
            "sort": 1,
            "enabled": True,
        },
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text
    nav_id = resp.json()["data"]["id"]
    tree = client.get("/api/v1/admin/navigation", headers=admin_headers).json()["data"]
    fragrance = next(n for n in tree if n["id"] == 2)
    assert any(c["id"] == nav_id for c in fragrance["children"])


def test_navigation_delete_with_children(client: TestClient, admin_headers: dict) -> None:
    """M2-NAV-004：删除含子项导航（香水 id=2 有 2 个子项）→ 422 NAV_HAS_CHILDREN。"""
    resp = client.delete("/api/v1/admin/navigation/2", headers=admin_headers)
    assert resp.status_code == 422
    assert resp.json()["code"] == 42200


def test_navigation_toggle(client: TestClient, admin_headers: dict) -> None:
    """M2-NAV-005：启停导航 → enabled 状态翻转。"""
    resp = client.put(
        "/api/v1/admin/navigation/1/toggle", json={"enabled": False}, headers=admin_headers
    )
    assert resp.status_code == 200
    tree = client.get("/api/v1/admin/navigation", headers=admin_headers).json()["data"]
    home = next(n for n in tree if n["id"] == 1)
    assert home["enabled"] is False


def test_navigation_delete_leaf(client: TestClient, admin_headers: dict) -> None:
    """M2-NAV-006：删除叶子导航（首页 id=1，无子项）→ 200。"""
    resp = client.delete("/api/v1/admin/navigation/1", headers=admin_headers)
    assert resp.status_code == 200


# ============================================================================
# 分类 CRUD（M2-CAT）
# ============================================================================

def test_top_category_slug_conflict(client: TestClient, admin_headers: dict) -> None:
    """M2-CAT-001：顶层 slug 冲突（已有 skincare）→ 409 / 40900。"""
    resp = client.post(
        "/api/v1/admin/top-categories",
        json={"slug": "skincare", "sort": 9, "enabled": True},
        headers=admin_headers,
    )
    assert resp.status_code == 409
    assert resp.json()["code"] == 40900


def test_top_category_create_and_delete(client: TestClient, admin_headers: dict) -> None:
    """M2-CAT-002：顶层分类创建 + 删除（无产品场景）→ 201 / 200。"""
    resp = client.post(
        "/api/v1/admin/top-categories",
        json={"slug": "testcat", "sort": 9, "enabled": True},
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text
    cat_id = resp.json()["data"]["id"]

    resp = client.delete(f"/api/v1/admin/top-categories/{cat_id}", headers=admin_headers)
    assert resp.status_code == 200


def test_top_category_delete_with_products(client: TestClient, admin_headers: dict) -> None:
    """M2-CAT-003：删除含产品顶层（skincare 下创建产品后）→ 422。"""
    _create_product(client, admin_headers)
    resp = client.delete("/api/v1/admin/top-categories/3", headers=admin_headers)
    assert resp.status_code == 422
    assert resp.json()["code"] == 42200


def test_sub_category_slug_conflict(client: TestClient, admin_headers: dict) -> None:
    """M2-CAT-004：二级 slug 冲突（同 top_id 下已有 serum）→ 409。"""
    resp = client.post(
        "/api/v1/admin/sub-categories",
        json={"top_id": 3, "slug": "serum", "name": {"zh": "重复", "en": "Dup"}, "sort": 9},
        headers=admin_headers,
    )
    assert resp.status_code == 409


def test_sub_category_create(client: TestClient, admin_headers: dict) -> None:
    """M2-CAT-005：二级分类创建 → 201 + 双语名称正确。"""
    resp = client.post(
        "/api/v1/admin/sub-categories",
        json={
            "top_id": 3,
            "slug": "mask",
            "name": {"zh": "面膜", "en": "Masks"},
            "sort": 9,
        },
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text
    sub_id = resp.json()["data"]["id"]

    resp = client.get(
        "/api/v1/admin/sub-categories?top_id=3", headers=admin_headers
    )
    items = resp.json()["data"]
    created = next(i for i in items if i["id"] == sub_id)
    assert created["name"] == {"zh": "面膜", "en": "Masks"}


def test_sub_category_delete_with_products(client: TestClient, admin_headers: dict) -> None:
    """M2-CAT-006：删除含产品二级分类（serum id=10 下有产品）→ 422。"""
    _create_product(client, admin_headers)  # sub_id=10 (serum)
    resp = client.delete("/api/v1/admin/sub-categories/10", headers=admin_headers)
    assert resp.status_code == 422
    assert resp.json()["code"] == 42200


def test_sub_category_create_missing_parent(client: TestClient, admin_headers: dict) -> None:
    """M2-CAT-007：二级分类挂到不存在的顶层 → 404。"""
    resp = client.post(
        "/api/v1/admin/sub-categories",
        json={"top_id": 999, "slug": "x", "name": {"zh": "X", "en": "X"}, "sort": 1},
        headers=admin_headers,
    )
    assert resp.status_code == 404


# ============================================================================
# 产品 CRUD（M2-PROD）
# ============================================================================

def test_product_create_and_get(client: TestClient, admin_headers: dict) -> None:
    """M2-PROD-001：产品创建 → 201 + 详情完整（图片/色号/分类链）。"""
    pid = _create_product(client, admin_headers)
    resp = client.get(f"/api/v1/admin/products/{pid}", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["name"]["zh"] == "焕颜精华"
    assert len(data["images"]) == 2
    assert data["translation_complete"] is True
    assert data["sub_category"]["slug"] == "serum"


def test_product_ref_code_conflict(client: TestClient, admin_headers: dict) -> None:
    """M2-PROD-002：ref_code 冲突 → 409 / 40900。"""
    _create_product(client, admin_headers, ref_code="HY-SK-T001")
    resp = client.post(
        "/api/v1/admin/products", json=PRODUCT_PAYLOAD, headers=admin_headers
    )
    assert resp.status_code == 409
    assert resp.json()["code"] == 40900


def test_product_images_require_single_cover(client: TestClient, admin_headers: dict) -> None:
    """M2-PROD-003：images 必须且仅 1 张主图（多主图 → 400）。"""
    payload = dict(PRODUCT_PAYLOAD)
    payload["ref_code"] = "HY-SK-T003"
    payload["images"] = [
        {"url": "https://cdn.haoyao.com/media/a.webp", "is_cover": True},
        {"url": "https://cdn.haoyao.com/media/b.webp", "is_cover": True},
    ]
    resp = client.post("/api/v1/admin/products", json=payload, headers=admin_headers)
    assert resp.status_code == 400  # Pydantic 校验 → 40000


def test_product_batch_status(client: TestClient, admin_headers: dict) -> None:
    """M2-PROD-004：批量下架 → 200 + updated 计数 + 列表状态翻转。"""
    pid1 = _create_product(client, admin_headers, ref_code="HY-SK-B1")
    pid2 = _create_product(client, admin_headers, ref_code="HY-SK-B2")
    resp = client.post(
        "/api/v1/admin/products/batch-status",
        json={"ids": [pid1, pid2], "status": "off"},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["updated"] == 2

    listing = client.get("/api/v1/admin/products?status=off", headers=admin_headers).json()["data"]
    assert listing["total"] == 2


def test_product_list_filters(client: TestClient, admin_headers: dict) -> None:
    """M2-PROD-005：列表 keyword 过滤（按 ref_code / 中文名匹配）。"""
    _create_product(client, admin_headers, ref_code="HY-SK-K01")
    # 按 ref_code 搜索
    resp = client.get(
        "/api/v1/admin/products?keyword=K01", headers=admin_headers
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["total"] == 1
    # 按中文名搜索
    resp = client.get(
        "/api/v1/admin/products?keyword=焕颜", headers=admin_headers
    )
    assert resp.json()["data"]["total"] == 1


def test_product_update(client: TestClient, admin_headers: dict) -> None:
    """M2-PROD-006：修改产品（改价 + 换图）→ 200 + 字段生效。"""
    pid = _create_product(client, admin_headers, ref_code="HY-SK-U1")
    payload = dict(PRODUCT_PAYLOAD)
    payload["ref_code"] = "HY-SK-U1"
    payload["price"] = 88800
    payload["images"] = [
        {"url": "https://cdn.haoyao.com/media/new.webp", "is_cover": True},
    ]
    resp = client.put(f"/api/v1/admin/products/{pid}", json=payload, headers=admin_headers)
    assert resp.status_code == 200

    detail = client.get(f"/api/v1/admin/products/{pid}", headers=admin_headers).json()["data"]
    assert detail["price"] == 88800
    assert len(detail["images"]) == 1


def test_product_delete(client: TestClient, admin_headers: dict) -> None:
    """M2-PROD-007：删除产品 → 200 + 详情 404。"""
    pid = _create_product(client, admin_headers, ref_code="HY-SK-D1")
    resp = client.delete(f"/api/v1/admin/products/{pid}", headers=admin_headers)
    assert resp.status_code == 200
    resp = client.get(f"/api/v1/admin/products/{pid}", headers=admin_headers)
    assert resp.status_code == 404


def test_product_create_missing_subcategory(client: TestClient, admin_headers: dict) -> None:
    """M2-PROD-008：产品挂到不存在二级分类 → 404。"""
    payload = dict(PRODUCT_PAYLOAD)
    payload["ref_code"] = "HY-SK-X1"
    payload["sub_id"] = 999
    resp = client.post("/api/v1/admin/products", json=payload, headers=admin_headers)
    assert resp.status_code == 404
