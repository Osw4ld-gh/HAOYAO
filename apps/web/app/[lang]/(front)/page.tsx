import type { Metadata } from "next";
import Link from "next/link";

import Carousel from "@/components/front/Carousel";
import ProductCard from "@/components/front/ProductCard";
import { t } from "@/lib/i18n";
import { fetchPublic } from "@/lib/api/client";
import { getSiteConfig } from "@/lib/api/site_config";
import type { HomeData } from "@/lib/api/types";
// hero 图作为 ES 资源 import（Next webpack asset module 处理，dev 实时可访问；
// 规避 Next 15.5 dev 模式不扫描 public/ 新增文件的 bug）
import heroBg from "@/public/haoyao_og_2x.png";

// ============================================================================
// HAOYAO 首页（app/[lang]/(front)/page.tsx，ISR 60s）
// 功能：Hero（品牌名 + 宣传语）+ Banner 轮播 + 新品区（≤8）+ 明星推荐（3）
//       + 品牌入口 + 最新资讯（M4 接入详情）。
// 依据：PRD §3.2 首页 / 原型 v2；数据源 /api/v1/home（ISR 60s 缓存）。
// ============================================================================

// ISR 60 秒（技术文档 §7.1 首页渲染策略）
export const revalidate = 60;

export const metadata: Metadata = {
  title: "HAOYAO 皓遥 | 皓启纯净，遥见本真",
  description: "高端美妆护肤品牌——皓启纯净，遥见本真。",
  alternates: {
    languages: {
      "zh-CN": "/",
      en: "/en",
    },
  },
  openGraph: {
    title: "HAOYAO 皓遥",
    description: "高端美妆护肤品牌——皓启纯净，遥见本真。",
    type: "website",
  },
};

interface HomePageProps {
  params: Promise<{ lang: string }>;
}

export default async function HomePage({ params }: HomePageProps) {
  const { lang } = await params;
  const locale = lang === "en" ? "en" : "zh";
  // M6 站点配置：驱动产品卡（价格/新品）显示开关
  const siteConfig = await getSiteConfig();
  const prefix = locale === "en" ? "/en" : "";

  // 首页聚合数据（ISR 60s，与页面 revalidate 对齐）
  const home = await fetchPublic<HomeData>("/home", { revalidate: 60, tags: ["home"] }).catch(
    () => null,
  );
  const newProducts = home?.new_products ?? [];
  const featured = home?.featured_products ?? [];
  const articles = home?.latest_articles ?? [];

  return (
    <div>
      {/* ============ Hero：HAOYAO 品牌名 + 宣传语（M9 视觉对齐高保真原型 v2）
          背景图 haoyao_og_2x.png（米白 + 抽象几何 + 山水波纹）；图已含品牌名，此处仅
          留 slogan 文字以兼顾 SEO 与无障碍（实际渲染被图覆盖） ============ */}
      <section
        style={{
          position: "relative",
          minHeight: "92vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundImage: `url(${heroBg.src})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          color: "var(--ink)",
          textAlign: "center",
          padding: "120px 24px 100px",
        }}
      >
        {/* 隐藏的可访问性副本（视觉被图覆盖，但屏幕阅读器与 SEO 仍读取） */}
        <div style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
          <h1>HAOYAO 皓遥</h1>
          <p>{t("home.slogan", locale)}</p>
        </div>
        {/* slogan 视觉层（可叠加图中或下移至空白区） */}
        <div style={{ position: "absolute", bottom: 80, left: "50%", transform: "translateX(-50%)", zIndex: 1 }}>
          <div
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(18px, 2vw, 26px)",
              fontWeight: 400,
              letterSpacing: "0.4em",
              color: "var(--ink-2)",
              opacity: 0,
            }}
          >
            {t("home.slogan", locale)}
          </div>
        </div>
      </section>

      {/* ============ Banner 轮播 ============ */}
      {home && home.banners.length > 0 && <Carousel banners={home.banners} locale={locale} />}

      {/* ============ 新品区（≤8，PRD §3.2-4） ============ */}
      {newProducts.length > 0 && (
        <section style={{ maxWidth: "var(--container-max)", margin: "0 auto", padding: "var(--section-gap) var(--container-pad) 0" }}>
          <SectionHead
            eyebrow="NEW ARRIVALS"
            title={t("home.newProducts", locale)}
          />
          <div style={{ display: "grid", gridTemplateColumns: "var(--grid-products)", gap: "var(--grid-gap)" }}>
            {newProducts.map((product) => (
              <ProductCard key={product.id} product={product} locale={locale} showPrice={siteConfig.switches.show_price} showNewTag={siteConfig.switches.show_new_tag} />
            ))}
          </div>
        </section>
      )}

      {/* ============ 明星推荐区（3 个，site_setting.featured_products） ============ */}
      {featured.length > 0 && (
        <section style={{ maxWidth: "var(--container-max)", margin: "0 auto", padding: "var(--section-gap) var(--container-pad) 0" }}>
          <SectionHead
            eyebrow="FEATURED"
            title={t("home.featured", locale)}
          />
          <div style={{ display: "grid", gridTemplateColumns: "var(--grid-featured)", gap: "var(--grid-gap)" }}>
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} locale={locale} />
            ))}
          </div>
        </section>
      )}

      {/* ============ 品牌入口 ============ */}
      <section style={{ maxWidth: "var(--container-max)", margin: "0 auto", padding: "var(--section-gap) var(--container-pad) 0" }}>
        <SectionHead eyebrow="THE HOUSE" title={t("home.discover", locale)} />
        <Link
          href={`${prefix}/about/story`}
          style={{
            display: "block",
            background: "var(--bg-soft)",
            padding: "48px 40px",
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: "var(--fs-h3)", letterSpacing: "0.2em", color: "var(--ink)" }}>
            {t("home.ourStory", locale)}
          </span>
          <span style={{ display: "block", marginTop: 12, fontSize: 14, color: "var(--gold-deep)", letterSpacing: "0.2em" }}>
            {t("home.explore", locale)}
          </span>
        </Link>
      </section>

      {/* ============ 最新资讯（M4 接入详情页） ============ */}
      {articles.length > 0 && (
        <section style={{ maxWidth: "var(--container-max)", margin: "0 auto", padding: "var(--section-gap) var(--container-pad) 0" }}>
          <SectionHead
            eyebrow="LATEST NEWS"
            title={t("home.latestNews", locale)}
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--grid-gap)" }}>
            {articles.map((article) => (
              <Link
                key={article.id}
                href={`${prefix}/news/${article.id}`}
                style={{ display: "block", padding: "24px 0", borderBottom: "1px solid var(--line)" }}
              >
                <div style={{ fontSize: 12, letterSpacing: "0.2em", color: "var(--ink-3)" }}>
                  {article.category === "company" ? t("home.companyNews", locale) : t("home.industryNews", locale)}
                </div>
                <div
                  style={{
                    marginTop: 10,
                    fontFamily: "var(--font-serif)",
                    fontSize: 18,
                    fontWeight: 500,
                    letterSpacing: "0.06em",
                    color: "var(--ink)",
                  }}
                >
                  {locale === "en" ? article.title.en || article.title.zh : article.title.zh}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 底部留白 */}
      <div style={{ height: "var(--section-gap)" }} />
    </div>
  );
}

/** 区块标题（英文小标 + 中文标题，UI 规范 §2.2 eyebrow） */
function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div style={{ marginBottom: "var(--section-head-gap)", textAlign: "center" }}>
      <div
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "var(--fs-eyebrow)",
          letterSpacing: "0.32em",
          color: "var(--gold-deep)",
          textTransform: "uppercase",
        }}
      >
        {eyebrow}
      </div>
      <h2
        style={{
          marginTop: 12,
          fontFamily: "var(--font-serif)",
          fontSize: "var(--fs-h2)",
          fontWeight: 400,
          letterSpacing: "0.15em",
          color: "var(--ink)",
        }}
      >
        {title}
      </h2>
    </div>
  );
}
