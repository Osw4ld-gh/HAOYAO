import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumb, Pagination } from "@/components/front/Ui";
import { t } from "@/lib/i18n";
import { fetchPublic } from "@/lib/api/client";
import type { ArticleCard } from "@/lib/api/types";

// ============================================================================
// HAOYAO 资讯列表页（app/[lang]/(front)/news/page.tsx，ISR 60s）
// 功能：资讯列表 —— Tab（全部/企业新闻/行业资讯）+ 分页。
// 依据：PRD §3.2 新闻资讯 / 技术文档 §7.1（ISR 60s + revalidateTag articles）。
// ============================================================================

export const revalidate = 60;

export const metadata: Metadata = { title: "新闻资讯" };

interface NewsPageProps {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ category?: string; page?: string }>;
}

export default async function NewsPage({ params, searchParams }: NewsPageProps) {
  const { lang } = await params;
  const { category: categoryParam, page: pageParam } = await searchParams;
  const locale = lang === "en" ? "en" : "zh";
  const prefix = locale === "en" ? "/en" : "";

  // 分类：all（默认）/ company / industry（非法值回退 all）
  const category = categoryParam === "company" || categoryParam === "industry" ? categoryParam : null;
  const page = Math.max(1, Number(pageParam ?? 1) || 1);
  const PAGE_SIZE = 12;

  const data = await fetchPublic<{
    total: number;
    page: number;
    page_size: number;
    items: ArticleCard[];
  }>(`/articles?page=${page}&page_size=${PAGE_SIZE}${category ? `&category=${category}` : ""}`, {
    revalidate: 60,
    tags: ["articles"],
  }).catch(() => null);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Tab（query 驱动，保留等价路由）
  const tabs = [
    { key: null, label: t("news.all", locale) },
    { key: "company", label: t("news.company", locale) },
    { key: "industry", label: t("news.industry", locale) },
  ] as const;

  return (
    <div style={{ maxWidth: "var(--container-max)", margin: "0 auto", padding: "48px var(--container-pad) 0" }}>
      <Breadcrumb crumbs={[{ label: t("common.home", locale), href: prefix || "/" }, { label: t("news.title", locale) }]} />

      <h1 style={{ margin: "24px 0 8px", fontSize: "var(--fs-h1)", fontWeight: 400, letterSpacing: "0.2em", color: "var(--ink)" }}>
        {locale === "en" ? "News" : "新闻资讯"}
      </h1>

      {/* 分类 Tab */}
      <nav style={{ display: "flex", gap: 28, borderBottom: "1px solid var(--line)", margin: "24px 0 32px" }}>
        {tabs.map((t) => (
          <Link
            key={t.key ?? "all"}
            href={t.key ? `${prefix}/news?category=${t.key}` : `${prefix}/news`}
            style={{
              padding: "12px 2px",
              fontSize: 14,
              letterSpacing: "0.12em",
              color: category === t.key ? "var(--ink)" : "var(--ink-3)",
              borderBottom: `2px solid ${category === t.key ? "var(--gold)" : "transparent"}`,
              marginBottom: -1,
            }}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {/* 资讯列表 */}
      {items.length === 0 ? (
        <div style={{ padding: "60px 0", textAlign: "center", color: "var(--ink-3)", fontSize: 14, letterSpacing: "0.1em" }}>
          {t("news.noNews", locale)}
        </div>
      ) : (
        <>
          <div>
            {items.map((article) => (
              <Link
                key={article.id}
                href={`${prefix}/news/${article.id}`}
                className="news-item" style={{ display: "flex", gap: 24, padding: "24px 0", borderBottom: "1px solid var(--line)" }}
              >
                {/* 封面 */}
                {article.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={article.cover_url} alt="" style={{ width: 200, height: 120, objectFit: "cover", background: "var(--bg-soft)", flexShrink: 0 }} />
                ) : (
                  <span style={{ width: 200, height: 120, background: "var(--bg-soft)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-3)", fontSize: 12, letterSpacing: "0.2em" }}>
                    HAOYAO
                  </span>
                )}
                {/* 文本 */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, letterSpacing: "0.2em", color: "var(--gold-deep)" }}>
                    {article.category === "company" ? t("news.companyTag", locale) : t("news.industryTag", locale)}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 18, letterSpacing: "0.06em", color: "var(--ink)" }}>
                    {locale === "en" ? article.title.en || article.title.zh : article.title.zh}
                  </div>
                  {article.summary.zh || article.summary.en ? (
                    <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.8, color: "var(--ink-2)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {locale === "en" ? article.summary.en || article.summary.zh : article.summary.zh}
                    </p>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} baseHref={`/news${category ? `?category=${category}` : ""}`} locale={locale} />
        </>
      )}
      <div style={{ height: "var(--section-gap)" }} />
    </div>
  );
}
