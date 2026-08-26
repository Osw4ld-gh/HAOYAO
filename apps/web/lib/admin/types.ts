// ============================================================================
// HAOYAO 后台 API 类型（lib/admin/types.ts）
// 功能：后台管理端接口对应的 TypeScript 类型。
// 依据：《HAOYAO_官网_开发技术文档.md》§6.5 后台接口（snake_case 直通）。
// ============================================================================

import type { Bilingual } from "../api/types";

/** 后台产品行（列表，含 translation_complete / 封面 / 顶层分类） */
export interface AdminProduct {
  id: number;
  sub_id: number;
  name: Bilingual;
  ref_code: string;
  price: number;
  is_new: boolean;
  status: "on" | "off";
  sort: number;
  translation_complete: boolean;
  cover_image: string | null;
  top_id: number | null;
  top_name: string | null;
  created_at: string;
  updated_at: string;
}

/** 后台产品详情（含图片/色号/分类链） */
export interface AdminProductDetail extends AdminProduct {
  desc: Bilingual;
  ingredients: Bilingual;
  usage: Bilingual;
  variants: { name: Bilingual; image_url: string }[];
  images: { url: string; is_cover: boolean; sort: number }[];
  sub_category: {
    id: number;
    top_id: number;
    slug: string;
    name: Bilingual;
  } | null;
}

/** 产品创建/更新请求体（M6 前图片 URL 直填） */
export interface ProductPayload {
  sub_id: number;
  name: Bilingual;
  ref_code: string;
  price: number;
  desc: Bilingual;
  ingredients: Bilingual;
  usage: Bilingual;
  variants: { name: Bilingual; image_url: string }[];
  is_new: boolean;
  status: "on" | "off";
  sort: number;
  images: { url: string; is_cover: boolean }[];
}

/** 顶层分类（含二级子集） */
export interface TopCategory {
  id: number;
  slug: string;
  sort: number;
  enabled: boolean;
  sub_categories: SubCategory[];
}

/** 二级分类 */
export interface SubCategory {
  id: number;
  top_id: number;
  slug: string;
  name: Bilingual;
  sort: number;
}

/** 导航树节点（后台管理，含停用项） */
export interface AdminNavNode {
  id: number;
  parent_id: number | null;
  label: Bilingual;
  link_type: "home" | "category" | "page" | "news" | "url";
  link_value: string;
  sort: number;
  enabled: boolean;
  children: AdminNavNode[];
}

/** 导航创建/更新请求体 */
export interface NavPayload {
  parent_id: number | null;
  label: Bilingual;
  link_type: "home" | "category" | "page" | "news" | "url";
  link_value: string;
  sort: number;
  enabled: boolean;
}

/** 统一分页（后台列表） */
export interface AdminPageData<T> {
  total: number;
  page: number;
  page_size: number;
  items: T[];
}
