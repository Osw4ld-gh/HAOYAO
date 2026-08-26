-- ============================================================================
-- HAOYAO（皓遥）官网 数据库初始化脚本（SQLite）
-- 依据：HAOYAO_官网_数据库设计文档.md V1.0（2026-08-26）
-- 环境：SQLite 3.4x + JSON1 扩展（SQLAlchemy 连接时自动启用 WAL/外键）
-- 用法：sqlite3 haoyao.db < haoyao_schema.sql
-- ============================================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

-- ============================================================================
-- 1. 建表（按依赖顺序）
-- ============================================================================

-- 1.1 管理员账号（单管理员）
CREATE TABLE admin_user (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,               -- BCrypt 哈希
    created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- 1.2 顶层分类（香水/彩妆/护肤品）
CREATE TABLE top_category (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    slug       TEXT    NOT NULL UNIQUE,           -- fragrance / makeup / skincare
    sort       INTEGER NOT NULL DEFAULT 0,
    enabled    INTEGER NOT NULL DEFAULT 1,        -- 1 启用 / 0 停用
    created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    updated_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- 1.3 二级分类（女士/男士、底妆/唇妆/…、清洁/水润/…）
CREATE TABLE sub_category (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    top_id     INTEGER NOT NULL REFERENCES top_category(id) ON DELETE CASCADE,
    slug       TEXT    NOT NULL,                  -- 同 top_id 下唯一
    name_json  TEXT    NOT NULL,                  -- {"zh":"精华","en":"Serums"}
    sort       INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    updated_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    UNIQUE (top_id, slug)
);

-- 1.4 产品
CREATE TABLE product (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    sub_id           INTEGER NOT NULL REFERENCES sub_category(id),  -- 含产品时禁删二级分类（应用层拦截）
    name_json        TEXT    NOT NULL,            -- {"zh":"焕颜精华","en":"Radiance Serum"}
    ref_code         TEXT    NOT NULL UNIQUE,     -- 参考编号，如 HY-SK-S001
    price            INTEGER NOT NULL DEFAULT 0 CHECK (price >= 0),  -- 整数分
    desc_json        TEXT    NOT NULL DEFAULT '{}',
    ingredients_json TEXT    NOT NULL DEFAULT '{}',
    usage_json       TEXT    NOT NULL DEFAULT '{}',
    variants_json    TEXT    NOT NULL DEFAULT '[]',  -- 色号列表，见文档 §4.16
    is_new           INTEGER NOT NULL DEFAULT 0,
    status           TEXT    NOT NULL DEFAULT 'off' CHECK (status IN ('on','off')),
    sort             INTEGER NOT NULL DEFAULT 0,
    created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- 1.5 产品图片（主图 + 多图）
CREATE TABLE product_image (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    url        TEXT    NOT NULL,                  -- CDN 地址
    is_cover   INTEGER NOT NULL DEFAULT 0,        -- 单主图由应用层保证
    sort       INTEGER NOT NULL DEFAULT 0
);

-- 1.6 资讯（企业新闻/行业资讯）
CREATE TABLE article (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    category     TEXT    NOT NULL CHECK (category IN ('company','industry')),
    title_json   TEXT    NOT NULL,
    summary_json TEXT    NOT NULL DEFAULT '{}',
    content_json TEXT    NOT NULL DEFAULT '{}',
    cover_url    TEXT,
    published_at TEXT,                            -- UTC；草稿为空
    status       TEXT    NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
    created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    updated_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- 1.7 品牌故事（单行）
CREATE TABLE story (
    id           INTEGER PRIMARY KEY CHECK (id = 1),
    title_json   TEXT NOT NULL DEFAULT '{}',
    content_json TEXT NOT NULL DEFAULT '{}',
    hero_image   TEXT,
    updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- 1.8 发展历程时间轴
CREATE TABLE timeline (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    year       INTEGER NOT NULL,
    title_json TEXT    NOT NULL,
    desc_json  TEXT    NOT NULL DEFAULT '{}',
    image_url  TEXT,
    sort       INTEGER NOT NULL DEFAULT 0
);

-- 1.9 主导航配置（自关联树）
CREATE TABLE navigation (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id  INTEGER REFERENCES navigation(id) ON DELETE CASCADE,  -- NULL = 顶层
    label_json TEXT    NOT NULL,                  -- {"zh":"香水","en":"Fragrance"}
    link_type  TEXT    NOT NULL CHECK (link_type IN ('home','category','page','news','url')),
    link_value TEXT    NOT NULL,                  -- 分类 slug / 页面 key / 完整 URL
    sort       INTEGER NOT NULL DEFAULT 0,
    enabled    INTEGER NOT NULL DEFAULT 1
);

-- 1.10 首页轮播
CREATE TABLE banner (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    image_url  TEXT    NOT NULL,
    title_json TEXT    NOT NULL DEFAULT '{}',
    link_type  TEXT    NOT NULL DEFAULT 'url' CHECK (link_type IN ('product','article','url')),
    link_value TEXT,
    sort       INTEGER NOT NULL DEFAULT 0,
    enabled    INTEGER NOT NULL DEFAULT 1
);

-- 1.11 网站配置（键值）
CREATE TABLE site_setting (
    key        TEXT PRIMARY KEY,                  -- contact / seo / switches / featured_products
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- 1.12 媒体库资源
CREATE TABLE media_asset (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    filename   TEXT    NOT NULL,
    url        TEXT    NOT NULL,                  -- CDN 地址（media/{uuid}.{ext}）
    type       TEXT    NOT NULL CHECK (type IN ('image','video')),
    size       INTEGER NOT NULL,                  -- 字节
    created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- 1.13 操作审计（只追加）
CREATE TABLE audit_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    operator    TEXT    NOT NULL,                 -- 管理员用户名
    action      TEXT    NOT NULL CHECK (action IN ('login','logout','create','update','delete','toggle','publish','batch_status')),
    target_type TEXT    NOT NULL,                 -- product / article / navigation / banner / ...
    target_id   TEXT,
    detail_json TEXT    NOT NULL DEFAULT '{}',
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- ============================================================================
-- 2. 索引
-- ============================================================================

-- 产品
CREATE INDEX idx_product_sub       ON product(sub_id);
CREATE INDEX idx_product_status    ON product(status);
CREATE INDEX idx_product_new_sort  ON product(is_new DESC, sort ASC);

-- 产品图片
CREATE INDEX idx_pimg_product      ON product_image(product_id);

-- 资讯
CREATE INDEX idx_article_list      ON article(category, status, published_at DESC);
CREATE INDEX idx_article_pub       ON article(published_at DESC);

-- 审计
CREATE INDEX idx_audit_time        ON audit_log(created_at DESC);

-- 补充索引（数据库设计文档 §5.3）
CREATE INDEX idx_sub_top           ON sub_category(top_id);
CREATE INDEX idx_nav_parent        ON navigation(parent_id);
CREATE INDEX idx_media_time        ON media_asset(created_at DESC);

-- ============================================================================
-- 3. 种子数据（占位；管理员密码由应用首启创建并覆盖）
-- ============================================================================

-- 3.1 管理员（占位哈希，生产以 ADMIN_PASSWORD_INIT 自动创建）
INSERT INTO admin_user (username, password_hash) VALUES ('admin', '<bcrypt_hash_placeholder>');

-- 3.2 顶层分类（显式 id，供二级分类与导航种子引用）
INSERT INTO top_category (id, slug, sort, enabled) VALUES
    (1, 'fragrance', 1, 1),
    (2, 'makeup',    2, 1),
    (3, 'skincare',  3, 1);

-- 3.3 二级分类（12 个占位）
INSERT INTO sub_category (id, top_id, slug, name_json, sort) VALUES
    (1,  1, 'women',     '{"zh":"女士","en":"Women"}',       1),
    (2,  1, 'men',       '{"zh":"男士","en":"Men"}',         2),
    (3,  2, 'base',      '{"zh":"底妆","en":"Base Makeup"}', 1),
    (4,  2, 'lip',       '{"zh":"唇妆","en":"Lips"}',        2),
    (5,  2, 'eye',       '{"zh":"眼妆","en":"Eyes"}',        3),
    (6,  2, 'blush',     '{"zh":"颊彩","en":"Cheeks"}',      4),
    (7,  2, 'tools',     '{"zh":"美妆工具","en":"Tools"}',   5),
    (8,  3, 'cleansing', '{"zh":"清洁","en":"Cleansing"}',   1),
    (9,  3, 'hydrating', '{"zh":"水润","en":"Hydrating"}',   2),
    (10, 3, 'serum',     '{"zh":"精华","en":"Serums"}',      3),
    (11, 3, 'cream',     '{"zh":"乳霜","en":"Creams"}',      4),
    (12, 3, 'sunscreen', '{"zh":"防晒","en":"Sunscreen"}',   5);

-- 3.4 主导航（6 顶层 + 5 二级，演示导航驱动；显式 id，parent_id 引用确定）
INSERT INTO navigation (id, parent_id, label_json, link_type, link_value, sort, enabled) VALUES
    (1, NULL, '{"zh":"首页","en":"Home"}',         'home',     '/',                   1, 1),
    (2, NULL, '{"zh":"香水","en":"Fragrance"}',   'category', 'fragrance',            2, 1),
    (3, NULL, '{"zh":"彩妆","en":"Makeup"}',      'category', 'makeup',               3, 1),
    (4, NULL, '{"zh":"护肤品","en":"Skincare"}',  'category', 'skincare',             4, 1),
    (5, NULL, '{"zh":"新闻资讯","en":"News"}',    'news',     'news/company',         5, 1),
    (6, NULL, '{"zh":"关于HAOYAO","en":"About"}', 'page',     'about/story',          6, 1);

INSERT INTO navigation (id, parent_id, label_json, link_type, link_value, sort, enabled) VALUES
    (7, 2, '{"zh":"女士","en":"Women"}',          'category', 'fragrance/women', 1, 1),
    (8, 2, '{"zh":"男士","en":"Men"}',            'category', 'fragrance/men',   2, 1),
    (9, 6, '{"zh":"品牌故事","en":"Story"}',      'page',     'about/story',     1, 1),
    (10, 6, '{"zh":"发展历程","en":"History"}',   'page',     'about/history',   2, 1),
    (11, 6, '{"zh":"联系我们","en":"Contact"}',   'page',     'about/contact',   3, 1);

-- 3.5 品牌故事（单行占位）
INSERT INTO story (id, title_json, content_json, hero_image) VALUES
    (1, '{"zh":"品牌故事（占位）","en":"Our Story (placeholder)"}',
        '{"zh":"皓启纯净，遥见本真。","en":"Pure beginnings, true vision."}', NULL);

-- 3.6 发展历程（2 条占位）
INSERT INTO timeline (year, title_json, desc_json, image_url, sort) VALUES
    (2024, '{"zh":"品牌创立（占位）","en":"Brand founded (placeholder)"}',
           '{"zh":"皓遥品牌启动。","en":"HAOYAO begins."}', NULL, 2),
    (2026, '{"zh":"官网上线（占位）","en":"Official site launch (placeholder)"}',
           '{"zh":"品牌数字阵地建成。","en":"Digital presence established."}', NULL, 1);

-- 3.7 资讯（1 草稿 + 1 已发布，演示状态机）
INSERT INTO article (category, title_json, summary_json, content_json, cover_url, published_at, status) VALUES
    ('company', '{"zh":"皓遥亮相国际美妆展（草稿）","en":"HAOYAO at Beauty Expo (draft)"}',
     '{"zh":"草稿示例。","en":"Draft example."}',
     '{"zh":"草稿正文（占位）。","en":"Draft content (placeholder)."}', NULL, NULL, 'draft'),
    ('industry', '{"zh":"2026 美妆行业趋势（占位）","en":"Beauty trends 2026 (placeholder)"}',
     '{"zh":"行业趋势摘要。","en":"Industry trend summary."}',
     '{"zh":"行业资讯正文（占位）。","en":"Industry article content (placeholder)."}', NULL, '2026-08-20T08:00:00Z', 'published');

-- 3.8 轮播（1 张占位）
INSERT INTO banner (image_url, title_json, link_type, link_value, sort, enabled) VALUES
    ('https://cdn.haoyao.com/media/b1.webp', '{"zh":"占位轮播","en":"Placeholder banner"}', 'url', 'https://www.haoyao.com', 1, 1);

-- 3.9 网站配置（4 键默认值）
INSERT INTO site_setting (key, value_json) VALUES
    ('contact', '{"phone":{"zh":"+86 400-000-0000","en":"+86 400-000-0000"},"email":"contact@haoyao.com","address":{"zh":"上海市静安区（占位）","en":"Jing''an, Shanghai (placeholder)"}}'),
    ('seo', '{"title":{"zh":"HAOYAO 皓遥官网","en":"HAOYAO Official"},"description":{"zh":"高端美妆护肤品牌","en":"Luxury beauty & skincare"},"keywords":{"zh":"皓遥,HAOYAO,美妆,护肤,香水","en":"HAOYAO,beauty,skincare,fragrance"},"og_image":""}'),
    ('switches', '{"show_price":true,"show_new_tag":true}'),
    ('featured_products', '[]');

-- ============================================================================
-- 4. 初始化完成
-- ============================================================================
-- 说明：
-- 1) 管理员密码由 FastAPI 首启时以 ADMIN_USERNAME/ADMIN_PASSWORD_INIT 生成并覆写
-- 2) 上线前需按 PRD 附录 11.2 占位符清单补齐内容（联系方式/品牌故事/产品线/定价）
-- 3) 产品/产品图片/媒体资源不预置，由后台管理系统录入
-- ============================================================================
