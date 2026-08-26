// ============================================================================
// HAOYAO 前端 API 类型（lib/api/types.ts）
// 功能：与后端 REST API 对应的 TypeScript 类型（字段命名 snake_case 直通）。
// 依据：《HAOYAO_官网_开发技术文档.md》§6 接口定义 / §8.3 联调约定：
//   - 字段命名 snake_case 直通（不做 camelCase 映射，减少转换成本）
//   - 统一响应包 {code, message, data}；分页 {total, page, page_size, items}
//   - 金额为整数分；时间 ISO8601 UTC（带 Z）
// 说明：M1 建立骨架（核心卡片类型）；M2/M3 按接口清单逐步补全。
// ============================================================================

/** 统一响应包（技术文档 §6.2） */
export interface ApiResponse<T> {
  code: number; // 0 = 成功；非 0 见错误码表
  message: string;
  data: T | null;
}

/** 统一分页结构（技术文档 §1.4） */
export interface PageData<T> {
  total: number;
  page: number;
  page_size: number;
  items: T[];
}

/** 双语文本对象（_json 字段的传输形态） */
export interface Bilingual {
  zh: string;
  en: string;
}

/** 产品卡片（列表/首页共用，技术文档 §6.4.2；top_slug 为详情路由增强字段） */
export interface ProductCard {
  id: number;
  name: Bilingual;
  ref_code: string;
  price: number; // 整数分
  is_new: boolean;
  cover_image: string;
  top_slug?: string | null;
}

/** 产品色号/变体（数据库文档 §4.16） */
export interface ProductVariant {
  name: Bilingual;
  image_url: string;
}

/** 主导航节点（技术文档 §6.4.1） */
export interface NavNode {
  id: number;
  label: Bilingual;
  link_type: "home" | "category" | "page" | "news" | "url";
  link_value: string;
  children: NavNode[];
}

/** 首页轮播（技术文档 §6.4.2） */
export interface Banner {
  id: number;
  image_url: string;
  title: Bilingual;
  link_type: "product" | "article" | "url";
  link_value: string;
}

/** 资讯卡片（技术文档 §6.4.2 latest_articles） */
export interface ArticleCard {
  id: number;
  category: "company" | "industry";
  title: Bilingual;
  summary: Bilingual;
  cover_url: string | null;
  published_at: string;
}

/** 网站配置（M6：contact/seo/switches/featured_products 4 键） */
export interface SiteConfig {
  contact?: {
    phone: Bilingual;
    email: string;
    address: Bilingual;
  };
  switches: {
    show_price: boolean;
    show_new_tag: boolean;
  };
  seo?: {
    title: Bilingual;
    description: Bilingual;
    keywords: Bilingual;
    og_image: string;
  };
  featured_products?: number[];
}

/** 分类节点（技术文档 §6.4.5 categories） */
export interface CategoryNode {
  id: number;
  slug: string;
  name?: Bilingual;
  children?: CategoryNode[];
}

/** 首页聚合（技术文档 §6.4.2 /home） */
export interface HomeData {
  banners: Banner[];
  new_products: ProductCard[];
  featured_products: ProductCard[];
  latest_articles: ArticleCard[];
}

/** 产品详情（技术文档 §6.4.4 /products/{id}） */
export interface ProductDetail {
  id: number;
  name: Bilingual;
  ref_code: string;
  price: number;
  is_new: boolean;
  desc: Bilingual;
  ingredients: Bilingual;
  usage: Bilingual;
  images: { url: string; is_cover: boolean }[];
  variants: ProductVariant[];
  sub_category: {
    id: number;
    slug: string;
    top_slug: string;
    name: Bilingual;
  } | null;
  related: ProductCard[];
}
