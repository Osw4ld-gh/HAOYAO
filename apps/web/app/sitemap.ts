import type { MetadataRoute } from "next";

import { fetchPublic } from "@/lib/api/client";
import type { PageData, ProductCard } from "@/lib/api/types";

// ============================================================================
// HAOYAO sitemap（app/sitemap.ts）
// 功能：全站 URL 清单（中英文双语版本），覆盖静态页 + 动态产品/资讯页。
// 依据：方案 §4-M5（sitemap 含双语 URL）+ 技术文档 §7.5 SEO：
//   - 中文 URL 无前缀；英文 URL /en 前缀
//   - 产品详情 /{top_slug}/p/{id}；资讯详情 /news/{id}
// ============================================================================

// 站点域名（上线前替换为正式域名；环境变量 SITE_URL 优先）
const SITE_URL = process.env.SITE_URL ?? "https://www.haoyao.com";

/** 静态页面路径（中文站无前缀；英文站自动加 /en） */
const STATIC_PATHS: { path: string; priority: number }[] = [
  { path: "/", priority: 1.0 },
  { path: "/fragrance", priority: 0.9 },
  { path: "/makeup", priority: 0.9 },
  { path: "/skincare", priority: 0.9 },
  { path: "/about/story", priority: 0.6 },
  { path: "/about/history", priority: 0.6 },
  { path: "/about/contact", priority: 0.6 },
  { path: "/news", priority: 0.7 },
  { path: "/join/social", priority: 0.4 },
  { path: "/join/campus", priority: 0.4 },
  { path: "/privacy", priority: 0.2 },
];

/** 生成双语 URL 条目（中文无前缀 + 英文 /en 前缀） */
function bilingual(path: string, priority: number): MetadataRoute.Sitemap[number][] {
  return [
    {
      url: `${SITE_URL}${path}`,
      lastModified: new Date(),
      changeFrequency: path === "/" ? "daily" : "weekly",
      priority,
      // hreflang 备选（Next.js 自动生成 alternate）
    },
    {
      url: `${SITE_URL}/en${path}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority,
    },
  ];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const urls: MetadataRoute.Sitemap = [];

  // 1) 静态页面（双语）
  for (const { path, priority } of STATIC_PATHS) {
    urls.push(...bilingual(path, priority));
  }

  // 2) 二级分类页（双语）：fragrance/makeup/skincare 下全部二级
  const subSlugs: Record<string, string[]> = {
    fragrance: ["women", "men"],
    makeup: ["base", "lips", "eyes", "cheek", "tools"],
    skincare: ["cleanse", "moisturize", "serum", "cream", "spf"],
  };
  for (const [top, subs] of Object.entries(subSlugs)) {
    for (const sub of subs) {
      urls.push(...bilingual(`/${top}/${sub}`, 0.8));
    }
  }

  // 3) 产品详情（双语）：拉取上架产品 id + 所属顶层
  try {
    const data = await fetchPublic<PageData<ProductCard>>("/products?page_size=100", {
      revalidate: 3600,
    });
    for (const product of data.items) {
      const topSlug = product.top_slug ?? "skincare";
      urls.push(...bilingual(`/${topSlug}/p/${product.id}`, 0.7));
    }
  } catch {
    // 产品接口不可达时跳过动态条目（sitemap 不因此失败）
  }

  // 4) 资讯详情（双语）：拉取已发布资讯 id
  try {
    const articles = await fetchPublic<{
      total: number;
      items: { id: number }[];
    }>("/articles?page_size=100", { revalidate: 3600 });
    for (const article of articles.items) {
      urls.push(...bilingual(`/news/${article.id}`, 0.6));
    }
  } catch {
    // 同上
  }

  return urls;
}
