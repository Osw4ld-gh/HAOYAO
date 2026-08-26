import type { Metadata } from "next";

// ============================================================================
// HAOYAO 根布局（app/layout.tsx）
// 功能：全站唯一根布局 —— <html>/<body> + 全局样式 + 全站 SEO 基建：
//   - metadata：默认标题/描述 + hreflang（zh-CN ↔ en 等价路由）
//   - Organization JSON-LD（结构化数据，技术文档 §7.5）
// 说明：后台 /admin 与前台 /[lang] 平级共用本根布局。
// ============================================================================

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "HAOYAO 皓遥 | 皓启纯净，遥见本真",
    template: "%s | HAOYAO 皓遥",
  },
  description: "高端美妆护肤品牌——皓启纯净，遥见本真。",
  // 双语 hreflang（静态页默认；动态页在各自 generateMetadata 覆盖）
  alternates: {
    languages: {
      "zh-CN": "/",
      en: "/en",
    },
  },
};

// Organization 结构化数据（JSON-LD，技术文档 §7.5）
const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "HAOYAO（皓遥）",
  alternateName: "HAOYAO",
  slogan: "皓启纯净，遥见本真",
  description: "高端美妆护肤品牌",
  url: process.env.SITE_URL ?? "https://www.haoyao.com",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <head>
        {/* Organization JSON-LD（全站注入一次） */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSON_LD) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
