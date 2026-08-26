// ============================================================================
// HAOYAO 前台 site-config 工具（lib/api/site_config.ts）
// 功能：服务端组件获取前台公开 site-config（contact/seo/switches/featured_products）。
// 依据：M6 前台接入 site-config 校验（Footer 邮箱/电话/地址、ProductCard 价格/新品开关）。
// 说明：layout/页面 fetchPublic 拉取（revalidate=0 SSR 实时；后台写后 revalidate 通知刷新）。
// ============================================================================

import { fetchPublic } from "./client";
import type { SiteConfig as ApiSiteConfig } from "./types";

/** 前台 SiteConfig 缺省值（接口失败时使用，保证页面不白屏） */
export const SITE_CONFIG_DEFAULTS: ApiSiteConfig = {
  contact: {
    phone: { zh: "", en: "" },
    email: "service@haoyao.com",
    address: { zh: "", en: "" },
  },
  switches: { show_price: true, show_new_tag: true },
  seo: {
    title: { zh: "", en: "" },
    description: { zh: "", en: "" },
    keywords: { zh: "", en: "" },
    og_image: "",
  },
  featured_products: [],
};

/** 服务端拉取前台公开 site-config（失败时返回缺省值） */
export async function getSiteConfig(): Promise<ApiSiteConfig> {
  const data = await fetchPublic<ApiSiteConfig>("/site-config", { revalidate: 0 }).catch(
    () => null,
  );
  if (!data) return SITE_CONFIG_DEFAULTS;
  // 合并缺省值（避免后台未配置某键时前端读到 undefined）
  return {
    contact: data.contact ?? SITE_CONFIG_DEFAULTS.contact,
    switches: data.switches ?? SITE_CONFIG_DEFAULTS.switches,
    seo: data.seo ?? SITE_CONFIG_DEFAULTS.seo,
    featured_products: data.featured_products ?? [],
  };
}
