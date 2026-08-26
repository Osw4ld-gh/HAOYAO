import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/front/Ui";
import { t } from "@/lib/i18n";
import { fetchPublic } from "@/lib/api/client";

// ============================================================================
// HAOYAO 资讯详情页（app/[lang]/(front)/news/[id]/page.tsx，ISR 60s）
// 功能：资讯正文 —— 分类标签 + 标题 + 摘要 + 正文。
// 依据：技术文档 §7.1（ISR 60s + revalidateTag articles）；草稿/不存在 → 404。
// ============================================================================

export const revalidate = 60;

interface NewsDetailProps {
  params: Promise<{ lang: string; id: string }>;
}

export async function generateMetadata({ params }: NewsDetailProps): Promise<Metadata> {
  const { lang, id } = await params;
  const locale = lang === "en" ? "en" : "zh";
  const article = await fetchPublic<{
    id: number;
    category: "company" | "industry";
    title: { zh: string; en: string };
    summary: { zh: string; en: string };
    content: { zh: string; en: string };
    cover_url: string;
    published_at: string;
  }>(`/articles/${id}`, { revalidate: 60, tags: ["articles"] }).catch(() => null);
  const title = article ? (locale === "en" ? article.title.en || article.title.zh : article.title.zh) : `资讯 ${id}`;
  const summary = article ? (locale === "en" ? article.summary.en || article.summary.zh : article.summary.zh) : "";

  return {
    title,
    description: summary ? summary.slice(0, 150) : undefined,
    alternates: {
      languages: {
        "zh-CN": `/news/${id}`,
        en: `/en/news/${id}`,
      },
    },
    openGraph: {
      title,
      description: summary ? summary.slice(0, 150) : undefined,
      images: article?.cover_url ? [{ url: article.cover_url }] : undefined,
      type: "article",
    },
  };
}

export default async function NewsDetailPage({ params }: NewsDetailProps) {
  const { lang, id } = await params;
  const locale = lang === "en" ? "en" : "zh";
  const prefix = locale === "en" ? "/en" : "";

  // 详情（草稿 → 后端 404 → notFound 渲染 404 页）
  const article = await fetchPublic<{
    id: number;
    category: "company" | "industry";
    title: { zh: string; en: string };
    summary: { zh: string; en: string };
    content: { zh: string; en: string };
    cover_url: string;
    published_at: string;
  }>(`/articles/${id}`, { revalidate: 60, tags: ["articles"] }).catch(() => null);

  if (!article) notFound();

  const title = locale === "en" ? article.title.en || article.title.zh : article.title.zh;
  const content = locale === "en" ? article.content.en || article.content.zh : article.content.zh;

  // Article 结构化数据（JSON-LD，技术文档 §7.5）
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title.zh,
    description: article.summary.zh || undefined,
    image: article.cover_url || undefined,
    datePublished: article.published_at || undefined,
  };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px var(--container-pad) 96px" }}>
      {/* Article JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <Breadcrumb
        crumbs={[
          { label: t("common.home", locale), href: prefix || "/" },
          { label: t("news.title", locale), href: `${prefix}/news` },
          { label: title },
        ]}
      />

      {/* 分类标签 */}
      <div style={{ marginTop: 32, fontSize: 12, letterSpacing: "0.2em", color: "var(--gold-deep)" }}>
        {article.category === "company" ? t("news.companyTag", locale) : t("news.industryTag", locale)}
      </div>

      {/* 标题 */}
      <h1 style={{ marginTop: 14, fontSize: "var(--fs-h1)", fontWeight: 400, letterSpacing: "0.08em", lineHeight: 1.4, color: "var(--ink)" }}>
        {title}
      </h1>

      {/* 封面 */}
      {article.cover_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={article.cover_url} alt="" style={{ width: "100%", maxHeight: 360, objectFit: "cover", marginTop: 28, background: "var(--bg-soft)" }} />
      )}

      {/* 摘要 */}
      {article.summary.zh || article.summary.en ? (
        <p
          style={{
            marginTop: 28,
            fontSize: 15,
            lineHeight: 1.9,
            color: "var(--ink-2)",
            borderLeft: "3px solid var(--gold)",
            paddingLeft: 16,
          }}
        >
          {locale === "en" ? article.summary.en || article.summary.zh : article.summary.zh}
        </p>
      ) : null}

      {/* 正文 */}
      <div
        style={{ marginTop: 32, fontSize: 16, lineHeight: 2, color: "var(--ink-2)", whiteSpace: "pre-line" }}
      >
        {content || t("news.contentComing", locale)}
      </div>
    </div>
  );
}
