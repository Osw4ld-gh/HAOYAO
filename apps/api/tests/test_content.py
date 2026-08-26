# ============================================================================
# HAOYAO 后端：内容模块测试（故事 / 时间轴 / 资讯）
# 用例编号：M4-CON-xxx
# 对应《M4_测试用例.md》"内容 CRUD / 状态机 / 可见性过滤"模块：
#   - story 单行 UPSERT（id=1 幂等）
#   - timeline CRUD（年份倒序）
#   - articles 草稿-发布状态机（published_at 写入、草稿前台 404）
# ============================================================================

from __future__ import annotations

from fastapi.testclient import TestClient

STORY_PAYLOAD = {
    "title": {"zh": "品牌故事", "en": "Brand Story"},
    "content": {"zh": "皓启纯净，遥见本真。", "en": "Pure beginnings, true vision."},
    "hero_image": "https://cdn.haoyao.com/media/story.webp",
}

ARTICLE_PAYLOAD = {
    "category": "company",
    "title": {"zh": "新品发布", "en": "New Launch"},
    "summary": {"zh": "摘要", "en": "Summary"},
    "content": {"zh": "正文内容", "en": "Content body"},
    "cover_url": "https://cdn.haoyao.com/media/a1.webp",
}


# ============================================================================
# 品牌故事（M4-CON-STORY）
# ============================================================================

def test_story_save_and_read(client: TestClient, admin_headers: dict) -> None:
    """M4-CON-001：保存故事（UPSERT）→ 读回内容一致。"""
    resp = client.put("/api/v1/admin/story", json=STORY_PAYLOAD, headers=admin_headers)
    assert resp.status_code == 200

    resp = client.get("/api/v1/admin/story", headers=admin_headers)
    data = resp.json()["data"]
    assert data["id"] == 1
    assert data["title"] == {"zh": "品牌故事", "en": "Brand Story"}

    # 前台读（SSG 数据源）
    front = client.get("/api/v1/story").json()["data"]
    assert front["content"]["zh"] == "皓启纯净，遥见本真。"


def test_story_upsert_idempotent(client: TestClient, admin_headers: dict) -> None:
    """M4-CON-002：重复保存不产生新行（单行约束 id=1）。"""
    for _ in range(2):
        resp = client.put("/api/v1/admin/story", json=STORY_PAYLOAD, headers=admin_headers)
        assert resp.status_code == 200

    # 库中仅 1 行
    from app.core.db import SessionLocal
    from app.models import Story

    with SessionLocal() as db:
        assert db.query(Story).count() == 1


def test_story_read_structure(client: TestClient) -> None:
    """M4-CON-003：故事读接口 → 结构键完整（种子含 story 数据，不假设空）。"""
    resp = client.get("/api/v1/story")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert set(data.keys()) == {"title", "content", "hero_image"}
    assert set(data["title"].keys()) == {"zh", "en"}


# ============================================================================
# 时间轴（M4-CON-TL）
# ============================================================================

def test_timeline_crud(client: TestClient, admin_headers: dict) -> None:
    """M4-CON-004：时间轴 CRUD 全流程（创建/倒序列表/修改/删除）。"""
    # 创建 2 条（年份乱序验证倒序）
    r1 = client.post(
        "/api/v1/admin/timeline",
        json={
            "year": 2020,
            "title": {"zh": "创立", "en": "Founded"},
            "desc": {"zh": "品牌创立", "en": "Brand founded"},
            "image_url": "",
            "sort": 0,
        },
        headers=admin_headers,
    )
    r2 = client.post(
        "/api/v1/admin/timeline",
        json={
            "year": 2024,
            "title": {"zh": "出海", "en": "Global"},
            "desc": {"zh": "海外市场", "en": "Overseas"},
            "image_url": "",
            "sort": 0,
        },
        headers=admin_headers,
    )
    assert r1.status_code == 201 and r2.status_code == 201
    id1, id2 = r1.json()["data"]["id"], r2.json()["data"]["id"]

    # 前台列表：年份倒序（种子含 timeline，断言排序而非精确内容）
    front = client.get("/api/v1/timeline").json()["data"]
    years = [t["year"] for t in front]
    assert years == sorted(years, reverse=True), "时间轴应按年份倒序"

    # 修改
    resp = client.put(
        f"/api/v1/admin/timeline/{id2}",
        json={
            "year": 2024,
            "title": {"zh": "出海 2.0", "en": "Global 2.0"},
            "desc": {"zh": "x", "en": "y"},
            "image_url": "",
            "sort": 1,
        },
        headers=admin_headers,
    )
    assert resp.status_code == 200

    # 删除后前台不再包含 id1
    resp = client.delete(f"/api/v1/admin/timeline/{id1}", headers=admin_headers)
    assert resp.status_code == 200
    front = client.get("/api/v1/timeline").json()["data"]
    assert all(t["id"] != id1 for t in front)


# ============================================================================
# 资讯（M4-CON-ART）
# ============================================================================

def _create_article(client: TestClient, headers: dict, category: str = "company") -> int:
    payload = dict(ARTICLE_PAYLOAD)
    payload["category"] = category
    resp = client.post("/api/v1/admin/articles", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()["data"]["id"]


def test_article_draft_invisible(client: TestClient, admin_headers: dict) -> None:
    """M4-CON-005：新资讯默认草稿 → 前台列表/详情均不可见。"""
    aid = _create_article(client, admin_headers)

    # 后台列表可见（草稿）
    resp = client.get("/api/v1/admin/articles", headers=admin_headers)
    assert resp.json()["data"]["total"] >= 1

    # 前台列表不含草稿
    front = client.get("/api/v1/articles").json()["data"]
    assert all(a["id"] != aid for a in front["items"])

    # 前台详情 404
    resp = client.get(f"/api/v1/articles/{aid}")
    assert resp.status_code == 404


def test_article_publish_flow(client: TestClient, admin_headers: dict) -> None:
    """M4-CON-006：发布 → 前台可见 + published_at 写入；幂等发布。"""
    aid = _create_article(client, admin_headers)

    resp = client.put(f"/api/v1/admin/articles/{aid}/publish", headers=admin_headers)
    assert resp.status_code == 200

    # 后台详情：状态 published + 发布时间非空
    detail = client.get(f"/api/v1/admin/articles/{aid}", headers=admin_headers).json()["data"]
    assert detail["status"] == "published"
    assert detail["published_at"]  # 发布时写入

    # 前台可见
    front = client.get(f"/api/v1/articles/{aid}")
    assert front.status_code == 200
    assert front.json()["data"]["title"]["zh"] == "新品发布"

    # 幂等发布（再次调用不报错）
    resp = client.put(f"/api/v1/admin/articles/{aid}/publish", headers=admin_headers)
    assert resp.status_code == 200


def test_article_category_filter(client: TestClient, admin_headers: dict) -> None:
    """M4-CON-007：资讯列表 category 过滤（company/industry）。"""
    company_id = _create_article(client, admin_headers, category="company")
    industry_id = _create_article(client, admin_headers, category="industry")
    # 发布后前台可见
    for aid in (company_id, industry_id):
        client.put(f"/api/v1/admin/articles/{aid}/publish", headers=admin_headers)

    company = client.get("/api/v1/articles?category=company").json()["data"]
    industry = client.get("/api/v1/articles?category=industry").json()["data"]
    assert all(a["category"] == "company" for a in company["items"])
    assert all(a["category"] == "industry" for a in industry["items"])


def test_article_update_keep_published(client: TestClient, admin_headers: dict) -> None:
    """M4-CON-008：已发布资讯修改后保持 published（状态机不倒退）。"""
    aid = _create_article(client, admin_headers)
    client.put(f"/api/v1/admin/articles/{aid}/publish", headers=admin_headers)

    payload = dict(ARTICLE_PAYLOAD)
    payload["title"] = {"zh": "更新标题", "en": "Updated Title"}
    resp = client.put(f"/api/v1/admin/articles/{aid}", json=payload, headers=admin_headers)
    assert resp.status_code == 200

    detail = client.get(f"/api/v1/admin/articles/{aid}", headers=admin_headers).json()["data"]
    assert detail["status"] == "published"
    assert detail["title"]["zh"] == "更新标题"

    # 前台读更新后内容
    front = client.get(f"/api/v1/articles/{aid}").json()["data"]
    assert front["title"]["zh"] == "更新标题"


def test_article_delete(client: TestClient, admin_headers: dict) -> None:
    """M4-CON-009：删除资讯 → 前后台均不可见。"""
    aid = _create_article(client, admin_headers)
    client.put(f"/api/v1/admin/articles/{aid}/publish", headers=admin_headers)

    resp = client.delete(f"/api/v1/admin/articles/{aid}", headers=admin_headers)
    assert resp.status_code == 200
    assert client.get(f"/api/v1/articles/{aid}").status_code == 404


def test_article_keyword_search(client: TestClient, admin_headers: dict) -> None:
    """M4-CON-010：后台列表 keyword 过滤（按中文标题）。"""
    payload = dict(ARTICLE_PAYLOAD)
    payload["title"] = {"zh": "独特关键词标题", "en": "Unique Keyword"}
    resp = client.post("/api/v1/admin/articles", json=payload, headers=admin_headers)
    assert resp.status_code == 201

    listed = client.get(
        "/api/v1/admin/articles?keyword=独特关键词", headers=admin_headers
    ).json()["data"]
    assert listed["total"] == 1


# ============================================================================
# 联系方式（M4-CON-CT）
# ============================================================================

def test_contact_read(client: TestClient) -> None:
    """M4-CON-011：联系方式读接口 → 结构完整（种子含 contact 键）。"""
    resp = client.get("/api/v1/contact")
    assert resp.status_code == 200
    data = resp.json()["data"]
    # 结构：phone/email/address（种子默认可能为空值，结构必须存在）
    assert set(data.keys()) == {"phone", "email", "address"}


# ============================================================================
# 翻译完整率统计（M5-STAT）
# ============================================================================

def test_translation_stats(client: TestClient, admin_headers: dict) -> None:
    """M5-STAT-001：翻译统计接口 → 产品/资讯 total/complete/incomplete 结构完整。"""
    # 建一个双语完整的产品 + 一个仅中文的产品
    for ref_code, zh, en in [
        ("HY-TR-COMPLETE", "完整品", "Complete"),
        ("HY-TR-PARTIAL", "不完整品", ""),
    ]:
        resp = client.post(
            "/api/v1/admin/products",
            json={
                "sub_id": 10,
                "name": {"zh": zh, "en": en},
                "ref_code": ref_code,
                "price": 1000,
                "desc": {"zh": "d", "en": "d"},
                "ingredients": {"zh": "i", "en": "i"},
                "usage": {"zh": "u", "en": "u"},
                "variants": [],
                "is_new": False,
                "status": "on",
                "sort": 0,
                "images": [{"url": "https://cdn.haoyao.com/media/x.webp", "is_cover": True}],
            },
            headers=admin_headers,
        )
        assert resp.status_code == 201

    resp = client.get("/api/v1/admin/translation-stats", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert set(data.keys()) == {"products", "articles"}
    assert set(data["products"].keys()) == {"total", "complete", "incomplete"}
    assert set(data["articles"].keys()) == {"total", "complete", "incomplete"}
    # 完整品 complete 计入；不完整品（en 空）不计
    assert data["products"]["complete"] >= 1
    assert data["products"]["incomplete"] >= 1
