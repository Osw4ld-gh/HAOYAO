import type { Metadata } from "next";

import Footer from "@/components/front/Footer";
import Header from "@/components/front/Header";
import { fetchPublic } from "@/lib/api/client";
import { getSiteConfig } from "@/lib/api/site_config";
import type { NavNode } from "@/lib/api/types";

// ============================================================================
// HAOYAO 前台布局（app/[lang]/layout.tsx）
// 功能：前台语言级布局 —— 主导航（SSR 实时）+ 内容区 + 4 列页脚。
// 说明：
//   - 导航/site-config 服务端拉取（revalidate=0 即 SSR 实时，后台修改即时生效）
//   - site_config.contact 传入 Footer（电话/邮箱/地址动态渲染）
//   - <html lang> 由根布局（app/layout.tsx）承载
// ============================================================================

export const metadata: Metadata = {
  title: {
    default: "HAOYAO 皓遥 | 皓启纯净，遥见本真",
    template: "%s | HAOYAO 皓遥",
  },
};

interface LangLayoutProps {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}

export default async function LangLayout({ children, params }: LangLayoutProps) {
  const { lang } = await params;
  // 校验语言：非 en 一律回退 zh
  const locale = lang === "en" ? "en" : "zh";

  // 主导航：SSR 实时拉取（技术文档 §6.4.1：不缓存，后台修改即时生效）
  const navItems = await fetchPublic<NavNode[]>("/navigation", { revalidate: 0 }).catch(
    () => [] as NavNode[],
  );
  // site-config：用于 Footer 联系方式（SSR 实时）
  const siteConfig = await getSiteConfig();

  return (
    <div className="front-shell">
      <Header navItems={navItems} locale={locale} />
      <main>{children}</main>
      <Footer locale={locale} contact={siteConfig.contact} />
    </div>
  );
}
