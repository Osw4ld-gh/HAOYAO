import type { MetadataRoute } from "next";

// ============================================================================
// HAOYAO robots.txt（app/robots.ts）
// 功能：搜索引擎抓取规则 + sitemap 指向。
// 依据：方案 §4-M5（robots）+ 技术文档 §7.5 SEO。
// ============================================================================

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.haoyao.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // 后台与内部接口不收录
        disallow: ["/admin/", "/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
