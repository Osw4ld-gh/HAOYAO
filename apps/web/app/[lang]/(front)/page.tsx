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
// - desktop: 16:8.4 横版（haoyao_og_2x.png 2400×1260）→ 1440 desktop aspect-ratio 还原
// - mobile:  4:5 portrait（haoyao_og_mobile.png 2160×2700）→ 375 mobile cover 不会被裁到只剩中央
import heroBgDesktop from "@/public/haoyao_og_2x.png";
import heroBgMobile from "@/public/haoyao_og_mobile.png";

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
          背景图：≤1023 用 haoyao_og_mobile.png（4:5 portrait），>1023 用 haoyao_og_2x.png（16:8.4 横版）
          切换靠 <picture><source media>，dev/prod 都生效（资源已 ES import 绕开 Next 15.5 bug） ============ */}
      <section
        className="hero-section"
        style={{
          backgroundColor: "var(--bg)",
          color: "var(--ink)",
        }}
      >
        <picture className="hero-picture">
          <source media="(max-width: 1023px)" srcSet={heroBgMobile.src} />
          <img
            src={heroBgDesktop.src}
            alt=""
            aria-hidden="true"
            className="hero-img"
          />
        </picture>
        {/* 隐藏的可访问性副本（视觉被图覆盖，但屏幕阅读器与 SEO 仍读取） */}
        <div style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
          <h1>HAOYAO 皓遥</h1>
          <p>{t("home.slogan", locale)}</p>
        </div>
        {/* slogan 视觉层（预留 v2 原型文字层入口；当前图内已含文字，opacity 0 隐藏） */}
        <div style={{ position: "absolute", bottom: "var(--hero-slogan-bottom, 80px)", left: "50%", transform: "translateX(-50%)", zIndex: 1 }}>
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
            eyebrow="New Arrivals"
            title={t("home.newProducts", locale)}
            subtitle={t("home.newProductsSub", locale)}
            linkText={t("home.viewAll", locale)}
            linkHref={`${prefix}/category/skincare`}
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
            eyebrow="The Icons"
            title={t("home.featured", locale)}
            subtitle={t("home.featuredSub", locale)}
          />
          <div style={{ display: "grid", gridTemplateColumns: "var(--grid-featured)", gap: "var(--grid-gap)" }}>
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} locale={locale} />
            ))}
          </div>
        </section>
      )}

      {/* ============ 品牌入口 ============ */}
      {/* ============ 品牌传承（v2 原型 §5.5：The Maison / 2 个 entry-card）
          旧实现是单 card 纯色块；现在改成 grid-2 + 2 个 entry-card（品牌故事 / 发展历程）
          ——背景用 inline SVG 占位（haoyao_brand_pattern），待 brand 方补图后替换 ============ */}
      <section style={{ maxWidth: "var(--container-max)", margin: "0 auto", padding: "var(--section-gap) var(--container-pad) 0" }}>
        <SectionHead
          eyebrow="The Maison"
          title={t("home.brandHeritage", locale)}
          subtitle={t("home.brandHeritageSub", locale)}
        />
        <div className="entry-grid">
          <Link href={`${prefix}/about/story`} className="entry-card" aria-label={t("home.ourStory", locale)}>
            <div className="entry-card-bg entry-card-bg--story" aria-hidden="true" />
            <div className="entry-card-overlay">
              <span className="entry-card-name">{t("home.ourStory", locale)}</span>
              <span className="entry-card-sub">OUR STORY</span>
            </div>
          </Link>
          <Link href={`${prefix}/about/history`} className="entry-card" aria-label={t("home.history", locale)}>
            <div className="entry-card-bg entry-card-bg--history" aria-hidden="true" />
            <div className="entry-card-overlay">
              <span className="entry-card-name">{t("home.history", locale)}</span>
              <span className="entry-card-sub">HISTORY</span>
            </div>
          </Link>
        </div>
      </section>

      {/* ============ 最新资讯（M4 接入详情页 / v2 原型 eyebrow 改 Journal + 加副标题） ============ */}
      {articles.length > 0 && (
        <section style={{ maxWidth: "var(--container-max)", margin: "0 auto", padding: "var(--section-gap) var(--container-pad) 0" }}>
          <SectionHead
            eyebrow="Journal"
            title={t("home.latestNews", locale)}
            subtitle={t("home.latestNewsSub", locale)}
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

/** 区块标题（英文小标 + 中文标题 + 副标题 + 可选 link-more 右链）
 *  UI 规范 §2.2 eyebrow / v2 原型 §section-head */
function SectionHead({ eyebrow, title, subtitle, linkText, linkHref }: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  linkText?: string;
  linkHref?: string;
}) {
  const hasLink = Boolean(linkText && linkHref);
  return (
    <div
      style={{
        marginBottom: "var(--section-head-gap)",
        display: "flex",
        flexDirection: hasLink ? "row" : "column",
        justifyContent: hasLink ? "space-between" : "center",
        alignItems: hasLink ? "flex-end" : "center",
        gap: hasLink ? 24 : 0,
        textAlign: "center",
      }}
    >
      {/* 左侧：eyebrow + 标题 + 副标题（垂直堆叠） */}
      <div style={{ flex: hasLink ? 1 : undefined }}>
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
        {subtitle && (
          <div
            style={{
              marginTop: 10,
              fontSize: 13,
              letterSpacing: "0.14em",
              color: "var(--ink-2)",
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
      {/* 右侧：link-more 右链（v2 prototype 风格） */}
      {hasLink && (
        <Link
          href={linkHref!}
          className="link-more"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: "var(--ink)",
            whiteSpace: "nowrap",
            paddingBottom: 8,    /* 与 h2 baseline 对齐 */
            transition: "color 0.3s var(--ease-brand)",
          }}
        >
          {linkText}
          <svg width="18" height="10" viewBox="0 0 18 10" fill="none" aria-hidden="true">
            <path d="M13 1l4 4-4 4M17 5H1" stroke="currentColor" strokeWidth="1" />
          </svg>
        </Link>
      )}
    </div>
  );
}
