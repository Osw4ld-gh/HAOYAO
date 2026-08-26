# ============================================================================
# HAOYAO 开发环境种子脚本（scripts/seed_dev.py）
# 功能：为本地开发/联调灌入演示数据（可重复执行，幂等）：
#   - 26 个演示产品（方案 V1.1：f1-f6 香水 / m1-m10 彩妆 / s1-s10 护肤）
#   - 品牌故事 / 发展历程示例 / 资讯示例（发布态）
#   - 联系方式（site_setting.contact）
# 用法：cd apps/api && .venv/Scripts/python.exe ..\..\scripts\seed_dev.py
# 依据：方案 §4-M4（dev seed 建议）· 数据库设计文档 §9 种子数据
# 说明：以 ref_code 判重（已存在跳过），不删除既有数据。
# ============================================================================

from __future__ import annotations

import os
import sys
from pathlib import Path

# 允许从任意目录运行：定位项目根并加入 sys.path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "apps" / "api"))

# 统一工作目录到 apps/api：settings.DATABASE_URL 为相对路径（sqlite:///./haoyao.db），
# 与 uvicorn 启动目录保持一致，避免生成第二个库文件
os.chdir(ROOT / "apps" / "api")

from sqlalchemy.orm import Session  # noqa: E402

from app.core.db import SessionLocal, engine  # noqa: E402
from app.core.init_db import init_db  # noqa: E402
from app.models import (  # noqa: E402
    Article,
    Product,
    ProductImage,
    SiteSetting,
    Story,
    Timeline,
)

# 图片域名（占位 CDN，M6 接入真实对象存储后替换）
CDN = "https://cdn.haoyao.com/media"


def bi(zh: str, en: str) -> dict:
    """双语结构快捷构造。"""
    return {"zh": zh, "en": en}


# ---------------------------------------------------------------------------
# 产品数据：(ref_code, sub_id, 中文名, 英文名, 价格分, is_new, 色号数)
# sub_id 映射（种子显式 id）：香水 women=1 men=2；彩妆 底妆3/唇妆4/眼妆5/颊彩6/工具7；
# 护肤 清洁8/水润9/精华10/乳霜11/防晒12
# ---------------------------------------------------------------------------
PRODUCTS: list[tuple[str, int, str, str, int, bool, int]] = [
    # 香水（f1-f6）
    ("HY-FRG-001", 1, "晨雾淡香水", "Morning Mist Eau", 68800, True, 0),
    ("HY-FRG-002", 1, "花影香水", "Floral Veil Parfum", 128000, False, 0),
    ("HY-FRG-003", 1, "静谧之夜", "Silent Night", 98000, False, 0),
    ("HY-FRG-004", 2, "岩兰男士淡香", "Vetiver Pour Homme", 108000, True, 0),
    ("HY-FRG-005", 2, "雪松古龙", "Cedar Cologne", 88000, False, 0),
    ("HY-FRG-006", 2, "远行", "Journey", 76800, False, 0),
    # 彩妆（m1-m10）
    ("HY-MKP-001", 3, "柔雾持妆粉底液", "Velvet Matte Foundation", 52000, True, 5),
    ("HY-MKP-002", 3, "光感气垫", "Luminous Cushion", 46000, False, 4),
    ("HY-MKP-003", 3, "遮瑕棒", "Conceal Stick", 32000, False, 3),
    ("HY-MKP-004", 4, "丝绒唇膏", "Velvet Lipstick", 36000, True, 6),
    ("HY-MKP-005", 4, "水光唇釉", "Glossy Lip Tint", 28000, False, 5),
    ("HY-MKP-006", 4, "雾面唇线笔", "Matte Lip Liner", 18000, False, 3),
    ("HY-MKP-007", 5, "大地色眼影盘", "Earth Tone Palette", 68000, False, 0),
    ("HY-MKP-008", 5, "纤长睫毛膏", "Lengthening Mascara", 26000, True, 0),
    ("HY-MKP-009", 6, "柔光腮红", "Soft Glow Blush", 24000, False, 4),
    ("HY-MKP-010", 7, "多功能美妆刷", "Multi Brush Set", 158000, False, 0),
    # 护肤（s1-s10）
    ("HY-SKN-001", 8, "氨基酸洁面乳", "Amino Cleanser", 22000, False, 0),
    ("HY-SKN-002", 8, "卸妆油", "Cleansing Oil", 29000, True, 0),
    ("HY-SKN-003", 9, "保湿精华水", "Hydra Essence", 34000, False, 0),
    ("HY-SKN-004", 9, "玻尿酸面膜", "Hyaluronic Mask", 18000, False, 0),
    ("HY-SKN-005", 10, "焕颜精华", "Radiance Serum", 128000, True, 0),
    ("HY-SKN-006", 10, "修护精华", "Repair Serum", 148000, False, 0),
    ("HY-SKN-007", 10, "美白精华", "Brightening Serum", 138000, False, 0),
    ("HY-SKN-008", 11, "保湿面霜", "Moisture Cream", 42000, False, 0),
    ("HY-SKN-009", 11, "紧致晚霜", "Firming Night Cream", 68000, True, 0),
    ("HY-SKN-010", 12, "清透防晒乳", "Sheer Sunscreen SPF50", 26000, False, 0),
]

# 演示文案（按 ref_code 前缀区分大类）
DESC = {
    "HY-FRG": ("前调清新，中调花香，后调木质。", "Fresh top, floral heart, woody base."),
    "HY-MKP": ("细腻质地，持久显色，打造高级妆容。", "Fine texture, long-wearing color."),
    "HY-SKN": ("温和配方，深入滋养，焕活肌肤本真。", "Gentle formula, deep nourishment."),
}

# 色号演示（彩妆）
SHADES = [
    ("豆沙", "Rosewood"), ("枫叶", "Maple"), ("蜜桃", "Peach"),
    ("奶茶", "Latte"), ("砖红", "Brick"), ("干枯玫瑰", "Dried Rose"),
]


def seed_products(db: Session) -> int:
    """灌入 26 个演示产品（ref_code 判重，幂等）。返回新增数。"""
    created = 0
    for ref_code, sub_id, zh, en, price, is_new, shade_count in PRODUCTS:
        exists = db.query(Product).filter(Product.ref_code == ref_code).first()
        if exists:
            continue

        prefix = ref_code.rsplit("-", 1)[0]
        desc_zh, desc_en = DESC.get(prefix, ("演示产品。", "Demo product."))
        variants = []
        for i in range(min(shade_count, len(SHADES))):
            s_zh, s_en = SHADES[i]
            variants.append(
                {"name": {"zh": s_zh, "en": s_en}, "image_url": f"{CDN}/v{ref_code}-{i}.webp"}
            )

        product = Product(
            sub_id=sub_id,
            name_json=bi(zh, en),
            ref_code=ref_code,
            price=price,
            desc_json=bi(desc_zh, desc_en),
            ingredients_json=bi("水、甘油、植物提取物等", "Water, Glycerin, Botanical Extracts"),
            usage_json=bi("早晚洁面后取适量涂抹。", "Apply after cleansing, morning and night."),
            variants_json=variants,
            is_new=is_new,
            status="on",
            sort=created,
        )
        db.add(product)
        db.flush()  # 取得 id 供图片外键
        db.add(
            ProductImage(
                product_id=product.id,
                url=f"{CDN}/p{ref_code}.webp",
                is_cover=True,
                sort=0,
            )
        )
        created += 1
    db.commit()
    return created


def seed_content(db: Session) -> None:
    """灌入内容示例（story / timeline / articles / contact，判重幂等）。"""
    # 品牌故事（UPSERT id=1）
    story = db.get(Story, 1)
    if story is None:
        story = Story(id=1)
        db.add(story)
    story.title_json = bi("品牌故事", "Our Story")
    story.content_json = bi(
        "皓遥（HAOYAO），以「皓启纯净，遥见本真」为理念，探索天然成分与现代科技的平衡，"
        "为每一位消费者带来纯净、真实的肌肤体验。",
        "HAOYAO explores the balance of natural ingredients and modern science, "
        "bringing pure and authentic skincare experiences.",
    )
    story.hero_image = f"{CDN}/story.webp"

    # 发展历程（示例 3 条，若已存在跳过）
    if db.query(Timeline).count() == 0:
        db.add_all(
            [
                Timeline(year=2020, title_json=bi("品牌创立", "Founded"), desc_json=bi("皓遥品牌于上海创立。", "HAOYAO founded in Shanghai."), sort=0),
                Timeline(year=2023, title_json=bi("首个系列上市", "First Collection"), desc_json=bi("护肤与香氛系列正式发布。", "Skincare & fragrance line launched."), sort=0),
                Timeline(year=2026, title_json=bi("开启全球之旅", "Going Global"), desc_json=bi("布局海外市场。", "Expanding overseas."), sort=0),
            ]
        )

    # 资讯示例（2 篇已发布 + 1 篇草稿，草稿仅后台可见）
    if db.query(Article).count() == 0:
        from app.models.base import utc_now

        now = utc_now()
        db.add_all(
            [
                Article(
                    category="company",
                    title_json=bi("皓遥发布 2026 全新香氛系列", "HAOYAO Unveils New Fragrance Collection 2026"),
                    summary_json=bi("以自然为灵感的全新香氛系列正式亮相。", "A nature-inspired fragrance line debuts."),
                    content_json=bi("皓遥 2026 香氛系列…（正文占位）", "HAOYAO 2026 fragrance collection… (body placeholder)"),
                    cover_url=f"{CDN}/news-fragrance.webp",
                    status="published",
                    published_at=now,
                ),
                Article(
                    category="industry",
                    title_json=bi("纯净美妆趋势观察", "Clean Beauty Trend Report"),
                    summary_json=bi("行业洞察：纯净配方成为消费者新共识。", "Clean formulas gain consumer trust."),
                    content_json=bi("行业报告正文…（占位）", "Industry report body… (placeholder)"),
                    cover_url=f"{CDN}/news-industry.webp",
                    status="published",
                    published_at=now,
                ),
                Article(
                    category="company",
                    title_json=bi("（草稿）品牌周报", "(Draft) Weekly Newsletter"),
                    summary_json=bi("", ""),
                    content_json=bi("草稿内容，前台不可见。", "Draft content, invisible on frontend."),
                    cover_url="",
                    status="draft",
                ),
            ]
        )

    # 联系方式（UPSERT contact 键）
    setting = db.query(SiteSetting).filter(SiteSetting.key == "contact").first()
    if setting is None:
        setting = SiteSetting(key="contact")
        db.add(setting)
    setting.value_json = {
        "phone": {"zh": "400-000-0000", "en": "+86 400-000-0000"},
        "email": "contact@haoyao.com",
        "address": {
            "zh": "上海市静安区（占位）",
            "en": "Jing'an District, Shanghai (placeholder)",
        },
    }

    db.commit()


def main() -> None:
    """主入口：初始化库（如未初始化）→ 灌入种子。"""
    # 确保表与基础种子存在（与启动路径一致，幂等）
    init_db()
    with SessionLocal() as db:
        n = seed_products(db)
        seed_content(db)
    print(f"seed_dev 完成：新增产品 {n} 个；story/timeline/articles/contact 已就绪")


if __name__ == "__main__":
    main()
