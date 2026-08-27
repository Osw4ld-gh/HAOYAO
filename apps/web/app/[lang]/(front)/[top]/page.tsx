import type { Metadata } from "next";
import { notFound } from "next/navigation";

import ProductCard from "@/components/front/ProductCard";
import { Breadcrumb, Pagination, TabBar, type TabItem } from "@/components/front/Ui";
import { t } from "@/lib/i18n";
import { fetchPublic } from "@/lib/api/client";
import { getSiteConfig } from "@/lib/api/site_config";
import type { CategoryNode, PageData, ProductCard as ProductCardType } from "@/lib/api/types";

// ============================================================================
// HAOYAO 顶层分类列表页（app/[lang]/(front)/[top]/page.tsx，ISR 60s）
// 功能：香水/彩妆/护肤品列表 —— 面包屑 + 二级分类 Tab + 产品网格 + 分页。
// 依据：PRD §3.2 列表页 / 技术文档 §7.1（ISR 60s + /products?top_slug=）。
// ============================================================================

// ISR 60 秒
export const revalidate = 60;

// 顶层分类白名单（不匹配则 404）
const TOP_SLUGS = ["fragrance", "makeup", "skincare"];

// 顶层分类默认展示名（导航数据缺失时兜底）
const TOP_LABEL: Record<string, { zh: string; en: string }> = {
  fragrance: { zh: "香水", en: "Fragrance" },
  makeup: { zh: "彩妆", en: "Makeup" },
  skincare: { zh: "护肤品", en: "Skincare" },
};

interface TopPageProps {
  params: Promise<{ lang: string; top: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateStaticParams() {
  // 静态生成 3 个顶层（中英文站各一份）
  return [
    { lang: "zh", top: "fragrance" },
    { lang: "zh", top: "makeup" },
    { lang: "zh", top: "skincare" },
    { lang: "en", top: "fragrance" },
    { lang: "en", top: "makeup" },
    { lang: "en", top: "skincare" },
  ];
}

export async function generateMetadata({ params }: TopPageProps): Promise<Metadata> {
  const { lang, top } = await params;
  const locale = lang === "en" ? "en" : "zh";
  const label = TOP_LABEL[top] ?? { zh: top, en: top };
  return { title: locale === "en" ? label.en : label.zh };
}

export default async function TopCategoryPage({ params, searchParams }: TopPageProps) {
  const { lang, top } = await params;
  const { page: pageParam } = await searchParams;
  const locale = lang === "en" ? "en" : "zh";
  const prefix = locale === "en" ? "/en" : "";

  // M6 站点配置：驱动产品卡（价格/新品）显示开关
  const siteConfig = await getSiteConfig();
  // 顶层白名单校验
  if (!TOP_SLUGS.includes(top)) notFound();

  const page = Math.max(1, Number(pageParam ?? 1) || 1);
  const PAGE_SIZE = 12;

  // 并行拉取：分类树（二级 Tab）+ 产品列表（ISR 60s）
  const [categories, list] = await Promise.all([
    fetchPublic<CategoryNode[]>("/categories", { revalidate: 0 }).catch(() => []),
    fetchPublic<PageData<ProductCardType>>(`/products?top_slug=${top}&page=${page}&page_size=${PAGE_SIZE}`, {
      revalidate: 60,
      tags: ["products"],
    }).catch(() => null),
  ]);

  // 当前顶层及其二级
  const topNode = categories.find((c) => c.slug === top);
  const subCategories = topNode?.children ?? [];

  // 二级 Tab（首页/全部 → 顶层页本身）
  const tabs: TabItem[] = [
    {
      label: t("common.all", locale),
      href: `${prefix}/${top}`,
      active: true,
    },
    ...subCategories.map((sub) => ({
      label: locale === "en" ? sub.name?.en || sub.slug : sub.name?.zh || sub.slug,
      href: `${prefix}/${top}/${sub.slug}`,
      active: false,
    })),
  ];

  const items = list?.items ?? [];
  const total = list?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const label = TOP_LABEL[top] ?? { zh: top, en: top };

  return (
    <div style={{ maxWidth: "var(--container-max)", margin: "0 auto", padding: "48px var(--container-pad) 0" }}>
      {/* 面包屑 */}
      <Breadcrumb
        crumbs={[
          { label: t("common.home", locale), href: prefix || "/" },
          { label: locale === "en" ? label.en : label.zh },
        ]}
      />

      {/* 页头 */}
      <h1 style={{ margin: "28px 0 8px", fontSize: "var(--fs-h1)", fontWeight: 400, letterSpacing: "0.2em", color: "var(--ink)" }}>
        {locale === "en" ? label.en : label.zh}
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
          <div style={{ display: "grid", gridTemplateColumns: "var(--grid-products)", gap: "var(--grid-gap)" }}>
            {items.map((product) => (
              <ProductCard key={product.id} product={product} locale={locale} showPrice={siteConfig.switches.show_price} showNewTag={siteConfig.switches.show_new_tag} />
            ))}
          </div>
          {/* 分页（?page=N） */}
          <Pagination page={page} totalPages={totalPages} baseHref={`/${top}`} locale={locale} />
        </>
      )}
      <div style={{ height: "var(--section-gap)" }} />
    </div>
  );
}
