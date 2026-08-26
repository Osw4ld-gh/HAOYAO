import type { Metadata } from "next";
import { notFound } from "next/navigation";

import ProductCard from "@/components/front/ProductCard";
import { Breadcrumb, Pagination, TabBar, type TabItem } from "@/components/front/Ui";
import { t } from "@/lib/i18n";
import { fetchPublic } from "@/lib/api/client";
import type { CategoryNode, PageData, ProductCard as ProductCardType } from "@/lib/api/types";

// ============================================================================
// HAOYAO 二级分类页（app/[lang]/(front)/[top]/[sub]/page.tsx，ISR 60s）
// 功能：如 /skincare/serum —— 面包屑 + Tab（当前二级高亮）+ 该二级产品网格。
// 依据：PRD §3.2 二级分类页（香水女士/男士、彩妆底妆/唇妆/眼妆/颊彩/美妆工具、
//       护肤清洁/水润/精华/乳霜/防晒）；技术文档 §7.1 ISR 60s。
// ============================================================================

export const revalidate = 60;

const TOP_SLUGS = ["fragrance", "makeup", "skincare"];
const TOP_LABEL: Record<string, { zh: string; en: string }> = {
  fragrance: { zh: "香水", en: "Fragrance" },
  makeup: { zh: "彩妆", en: "Makeup" },
  skincare: { zh: "护肤品", en: "Skincare" },
};

interface SubPageProps {
  params: Promise<{ lang: string; top: string; sub: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: SubPageProps): Promise<Metadata> {
  const { lang, top, sub } = await params;
  const locale = lang === "en" ? "en" : "zh";
  // 二级名来自分类树（metadata 无法拉数据，用 slug 兜底）
  return {
    title: `${sub} | ${TOP_LABEL[top] ? (locale === "en" ? TOP_LABEL[top].en : TOP_LABEL[top].zh) : top}`,
  };
}

export default async function SubCategoryPage({ params, searchParams }: SubPageProps) {
  const { lang, top, sub } = await params;
  const { page: pageParam } = await searchParams;
  const locale = lang === "en" ? "en" : "zh";
  const prefix = locale === "en" ? "/en" : "";

  if (!TOP_SLUGS.includes(top)) notFound();

  const page = Math.max(1, Number(pageParam ?? 1) || 1);
  const PAGE_SIZE = 12;

  // 分类树（Tab 与二级名校验）+ 该二级产品列表
  const [categories, list] = await Promise.all([
    fetchPublic<CategoryNode[]>("/categories", { revalidate: 0 }).catch(() => []),
    fetchPublic<PageData<ProductCardType>>(
      `/products?top_slug=${top}&sub_slug=${sub}&page=${page}&page_size=${PAGE_SIZE}`,
      { revalidate: 60, tags: ["products"] },
    ).catch(() => null),
  ]);

  const topNode = categories.find((c) => c.slug === top);
  const subCategories = topNode?.children ?? [];
  const currentSub = subCategories.find((s) => s.slug === sub);

  // 二级不存在 → 404（防止任意 slug 进入）
  if (!currentSub) notFound();

  // Tab：全部 → 顶层页；各二级 → 当前高亮
  const tabs: TabItem[] = [
    {
      label: t("common.all", locale),
      href: `${prefix}/${top}`,
      active: false,
    },
    ...subCategories.map((s) => ({
      label: locale === "en" ? s.name?.en || s.slug : s.name?.zh || s.slug,
      href: `${prefix}/${top}/${s.slug}`,
      active: s.slug === sub,
    })),
  ];

  const items = list?.items ?? [];
  const total = list?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const topLabel = TOP_LABEL[top] ?? { zh: top, en: top };
  const subLabel = locale === "en" ? currentSub.name?.en || sub : currentSub.name?.zh || sub;

  return (
    <div style={{ maxWidth: "var(--container-max)", margin: "0 auto", padding: "48px var(--container-pad) 0" }}>
      {/* 面包屑：首页 / 顶层 / 当前二级 */}
      <Breadcrumb
        crumbs={[
          { label: t("common.home", locale), href: prefix || "/" },
          { label: locale === "en" ? topLabel.en : topLabel.zh, href: `${prefix}/${top}` },
          { label: subLabel },
        ]}
      />

      {/* 页头：顶层名 + 二级名 */}
      <h1 style={{ margin: "28px 0 8px", fontSize: "var(--fs-h1)", fontWeight: 400, letterSpacing: "0.2em", color: "var(--ink)" }}>
        {locale === "en" ? subLabel : subLabel}
      </h1>

      {/* 二级分类 Tab */}
      <div style={{ margin: "28px 0 40px" }}>
        <TabBar items={tabs} />
      </div>

      {/* 产品网格 */}
      {items.length === 0 ? (
        <div style={{ padding: "80px 0", textAlign: "center", color: "var(--ink-3)", fontSize: 14, letterSpacing: "0.1em" }}>
          {t("list.noProducts", locale)}
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--grid-gap)" }}>
            {items.map((product) => (
              <ProductCard key={product.id} product={product} locale={locale} />
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} baseHref={`/${top}/${sub}`} locale={locale} />
        </>
      )}
      <div style={{ height: "var(--section-gap)" }} />
    </div>
  );
}
