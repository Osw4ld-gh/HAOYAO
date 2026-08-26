import type { Metadata } from "next";
import { notFound } from "next/navigation";

import ProductCard from "@/components/front/ProductCard";
import ProductGallery from "@/components/front/ProductGallery";
import { Breadcrumb } from "@/components/front/Ui";
import WhereToBuy from "@/components/front/WhereToBuy";
import { t } from "@/lib/i18n";
import { fetchPublic } from "@/lib/api/client";
import type { ProductDetail } from "@/lib/api/types";

// ============================================================================
// HAOYAO 产品详情页（app/[lang]/(front)/[top]/p/[id]/page.tsx，ISR 60s）
// 功能：多图画廊 + 名称/价格 + 功效/成分/用法（双语）+ 色号 + 相关推荐 4
//       + "了解购买渠道" CTA（纯展示品牌站，无电商，PRD §4.3）。
// 依据：技术文档 §7.1（详情路由 /{top}/p/{id}，ISR 60s）；
//       下架/不存在 → 404（后端 40400 → notFound 渲染 404 页）。
// ============================================================================

export const revalidate = 60;

const TOP_SLUGS = ["fragrance", "makeup", "skincare"];

interface ProductPageProps {
  params: Promise<{ lang: string; top: string; id: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { lang, top, id } = await params;
  const locale = lang === "en" ? "en" : "zh";
  // 复用页面 fetch（Next 对同 URL 请求自动去重），取产品名做 SEO title
  const detail = await fetchPublic<ProductDetail>(`/products/${id}`, {
    revalidate: 60,
    tags: ["products"],
  }).catch(() => null);
  const name = detail ? (locale === "en" ? detail.name.en || detail.name.zh : detail.name.zh) : `产品 ${id}`;
  const descText = detail ? (locale === "en" ? detail.desc.en || detail.desc.zh : detail.desc.zh) : "";

  return {
    title: name,
    description: descText ? descText.slice(0, 150) : undefined,
    alternates: {
      // 双语等价路由 hreflang
      languages: {
        "zh-CN": `/${top}/p/${id}`,
        en: `/en/${top}/p/${id}`,
      },
    },
    openGraph: {
      title: name,
      description: descText ? descText.slice(0, 150) : undefined,
      images: detail?.images[0] ? [{ url: detail.images[0].url }] : undefined,
      type: "website",
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { lang, top, id } = await params;
  const locale = lang === "en" ? "en" : "zh";
  const prefix = locale === "en" ? "/en" : "";

  // 顶层白名单（路由前缀随 top_slug，技术文档 §7.1）
  if (!TOP_SLUGS.includes(top)) notFound();

  // 详情（ISR 60s；404 时渲染 404）
  const detail = await fetchPublic<ProductDetail>(`/products/${id}`, {
    revalidate: 60,
    tags: ["products"],
  }).catch(() => null);
  if (!detail) notFound();

  const name = locale === "en" ? detail.name.en || detail.name.zh : detail.name.zh;
  const sub = detail.sub_category;

  // Product 结构化数据（JSON-LD，技术文档 §7.5）
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: detail.name.zh,
    description: detail.desc.zh || undefined,
    sku: detail.ref_code,
    image: detail.images.map((img) => img.url),
    offers: {
      "@type": "Offer",
      price: (detail.price / 100).toFixed(2),
      priceCurrency: "CNY",
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <div style={{ maxWidth: "var(--container-max)", margin: "0 auto", padding: "48px var(--container-pad) 0" }}>
      {/* Product JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      {/* 面包屑：首页 / 顶层 / 二级 / 产品名 */}
      <Breadcrumb
        crumbs={[
          { label: t("common.home", locale), href: prefix || "/" },
          { label: t(`nav.${top}`, locale), href: `${prefix}/${top}` },
          ...(sub
            ? [
                {
                  label: locale === "en" ? sub.name.en || sub.slug : sub.name.zh || sub.slug,
                  href: `${prefix}/${top}/${sub.slug}`,
                },
              ]
            : []),
          { label: name },
        ]}
      />

      {/* 主体：左图右文 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, marginTop: 32 }}>
        {/* 左：画廊 */}
        <ProductGallery images={detail.images} alt={name} />

        {/* 右：信息区 */}
        <div>
          {detail.is_new && (
            <span style={{ display: "inline-block", marginBottom: 12, padding: "3px 10px", fontSize: 11, letterSpacing: "0.2em", color: "#fff", background: "var(--red)" }}>
              {locale === "en" ? "NEW" : t("common.new", locale)}
            </span>
          )}
          <h1 style={{ fontSize: "var(--fs-h1)", fontWeight: 400, letterSpacing: "0.12em", color: "var(--ink)" }}>{name}</h1>
          <div style={{ marginTop: 8, fontSize: 13, color: "var(--ink-3)", letterSpacing: "0.1em" }}>
            {detail.ref_code}
          </div>
          <div style={{ marginTop: 20, fontSize: 20, letterSpacing: "0.08em", color: "var(--ink)" }}>
            ¥{(detail.price / 100).toFixed(2)}
          </div>

          {/* 功效描述 */}
          {detail.desc.zh || detail.desc.en ? (
            <div style={{ marginTop: 32 }}>
              <SectionLabel text={t("detail.description", locale)} />
              <p style={{ fontSize: 15, lineHeight: 1.9, color: "var(--ink-2)", marginTop: 10 }}>
                {locale === "en" ? detail.desc.en || detail.desc.zh : detail.desc.zh}
              </p>
            </div>
          ) : null}

          {/* 色号列表 */}
          {detail.variants.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <SectionLabel text={t("detail.shades", locale)} />
              <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                {detail.variants.map((v, i) => (
                  <span
                    key={i}
                    style={{
                      display: "inline-block",
                      padding: "8px 16px",
                      border: "1px solid var(--line)",
                      fontSize: 13,
                      letterSpacing: "0.06em",
                      color: "var(--ink)",
                    }}
                  >
                    {locale === "en" ? v.name.en || v.name.zh : v.name.zh}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 购买渠道 CTA（纯展示，无电商；client 组件处理点击） */}
          <WhereToBuy locale={locale} />
        </div>
      </div>

      {/* 成分 + 使用方式（两栏） */}
      {(detail.ingredients.zh || detail.ingredients.en || detail.usage.zh || detail.usage.en) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, marginTop: 80 }}>
          {detail.ingredients.zh || detail.ingredients.en ? (
            <div>
              <SectionLabel text={t("detail.ingredients", locale)} />
              <p style={{ fontSize: 14, lineHeight: 1.9, color: "var(--ink-2)", marginTop: 10, whiteSpace: "pre-line" }}>
                {locale === "en" ? detail.ingredients.en || detail.ingredients.zh : detail.ingredients.zh}
              </p>
            </div>
          ) : null}
          {detail.usage.zh || detail.usage.en ? (
            <div>
              <SectionLabel text={t("detail.usage", locale)} />
              <p style={{ fontSize: 14, lineHeight: 1.9, color: "var(--ink-2)", marginTop: 10, whiteSpace: "pre-line" }}>
                {locale === "en" ? detail.usage.en || detail.usage.zh : detail.usage.zh}
              </p>
            </div>
          ) : null}
        </div>
      )}

      {/* 相关推荐（同二级其他产品 ≤4） */}
      {detail.related.length > 0 && (
        <section style={{ marginTop: 96 }}>
          <SectionLabel text={t("detail.related", locale)} size="large" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--grid-gap)", marginTop: 28 }}>
            {detail.related.map((product) => (
              <ProductCard key={product.id} product={product} locale={locale} />
            ))}
          </div>
        </section>
      )}

      <div style={{ height: "var(--section-gap)" }} />
    </div>
  );
}

/** 区块小标题（详情页段落标签） */
function SectionLabel({ text, size = "normal" }: { text: string; size?: "normal" | "large" }) {
  return (
    <div
      style={{
        fontSize: size === "large" ? "var(--fs-h3)" : 13,
        letterSpacing: "0.2em",
        color: "var(--ink)",
        borderBottom: "1px solid var(--line)",
        paddingBottom: 10,
        fontWeight: 400,
      }}
    >
      {text}
    </div>
  );
}
