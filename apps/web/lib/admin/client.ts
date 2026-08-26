// ============================================================================
// HAOYAO 后台 API 客户端（lib/admin/client.ts）
// 功能：后台管理接口的 fetch 封装。
//   - token 管理：access_token 存 localStorage；401 时用 Refresh Cookie 自动刷新
//   - 统一响应解析 {code, message, data}；业务 code≠0 抛 AdminApiError
// 依据：《HAOYAO_官网_开发技术文档.md》§7.4：
//   - 请求头 Authorization: Bearer <access_token>
//   - refresh 走 HttpOnly Cookie（浏览器自动携带）
//   - 刷新成功后重试原请求一次
// ============================================================================

import type {
  AdminNavNode,
  AdminPageData,
  AdminProduct,
  AdminProductDetail,
  NavPayload,
  ProductPayload,
  SubCategory,
  TopCategory,
} from "./types";

// 开发默认后端地址（与 .env.example 一致；生产经环境变量注入）
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000/api/v1";

/** 后端统一响应包（与后端 §5.4 一致） */
interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T | null;
}

/** 业务错误（携带业务 code / HTTP 状态 / 响应 data） */
export class AdminApiError extends Error {
  code: number;
  status: number;
  data: unknown;
  constructor(code: number, message: string, status: number, data: unknown = null) {
    super(message);
    this.code = code;
    this.status = status;
    this.data = data;
  }
}

// ---------- token 管理 ----------
const TOKEN_KEY = "haoyao_admin_access_token";

export function getAccessToken(): string | null {
  // 仅客户端可访问 localStorage（SSR 期间返回 null）
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

// ---------- 请求核心 ----------
let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  // 并发防抖：多个 401 同时触发时只发起一次刷新
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const resp = await fetch(`${API_BASE}/admin/auth/refresh`, {
          method: "POST",
          credentials: "include", // 携带 Refresh Cookie
        });
        const body = (await resp.json()) as ApiEnvelope<{ access_token: string }>;
        if (!resp.ok || body.code !== 0) return null;
        setAccessToken(body.data!.access_token);
        return body.data!.access_token;
      } catch {
        return null;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
  allowRetry = true,
): Promise<T> {
  const { method = "GET", body } = options;
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // FormData（文件上传）：由浏览器自动生成 multipart 边界，不得手动设 Content-Type
  const isForm = body instanceof FormData;
  if (!isForm) headers["Content-Type"] = "application/json";

  const resp = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
  });

  // 401 且允许重试：尝试刷新后重放原请求
  if (resp.status === 401 && allowRetry) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return request<T>(path, options, false);
    }
    // 刷新失败：清除本地 token（回到登录页由页面层处理）
    setAccessToken(null);
    throw new AdminApiError(40100, "登录已过期，请重新登录", 401);
  }

  let envelope: ApiEnvelope<T>;
  try {
    envelope = (await resp.json()) as ApiEnvelope<T>;
  } catch {
    throw new AdminApiError(resp.status, "响应解析失败", resp.status);
  }

  if (!resp.ok || envelope.code !== 0) {
    throw new AdminApiError(
      envelope.code,
      envelope.message || "请求失败",
      resp.status,
      envelope.data,
    );
  }
  return envelope.data as T;
}

// ---------- 认证 ----------
export const authApi = {
  login: (username: string, password: string) =>
    request<{ access_token: string; expires_in: number }>("/admin/auth/login", {
      method: "POST",
      body: { username, password },
    }),
  logout: () =>
    request<null>("/admin/auth/logout", { method: "POST" }, false),
};

// ---------- 导航 ----------
export const navigationApi = {
  list: () => request<AdminNavNode[]>("/admin/navigation"),
  create: (body: NavPayload) =>
    request<{ id: number }>("/admin/navigation", { method: "POST", body }),
  update: (id: number, body: NavPayload) =>
    request<null>(`/admin/navigation/${id}`, { method: "PUT", body }),
  remove: (id: number) =>
    request<null>(`/admin/navigation/${id}`, { method: "DELETE" }),
  toggle: (id: number, enabled: boolean) =>
    request<null>(`/admin/navigation/${id}/toggle`, {
      method: "PUT",
      body: { enabled },
    }),
};

// ---------- 分类 ----------
export const categoryApi = {
  listTop: () => request<TopCategory[]>("/admin/top-categories"),
  createTop: (body: { slug: string; sort: number; enabled: boolean }) =>
    request<{ id: number }>("/admin/top-categories", { method: "POST", body }),
  updateTop: (
    id: number,
    body: { slug: string; sort: number; enabled: boolean },
  ) => request<null>(`/admin/top-categories/${id}`, { method: "PUT", body }),
  removeTop: (id: number) =>
    request<null>(`/admin/top-categories/${id}`, { method: "DELETE" }),
  listSub: (topId?: number) =>
    request<SubCategory[]>(
      `/admin/sub-categories${topId ? `?top_id=${topId}` : ""}`,
    ),
  createSub: (body: {
    top_id: number;
    slug: string;
    name: { zh: string; en: string };
    sort: number;
  }) => request<{ id: number }>("/admin/sub-categories", { method: "POST", body }),
  updateSub: (
    id: number,
    body: {
      top_id: number;
      slug: string;
      name: { zh: string; en: string };
      sort: number;
    },
  ) => request<null>(`/admin/sub-categories/${id}`, { method: "PUT", body }),
  removeSub: (id: number) =>
    request<null>(`/admin/sub-categories/${id}`, { method: "DELETE" }),
};

// ---------- 产品 ----------
export const productApi = {
  list: (params: {
    page?: number;
    page_size?: number;
    top_id?: number;
    sub_id?: number;
    status?: "on" | "off";
    keyword?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.page_size) qs.set("page_size", String(params.page_size));
    if (params.top_id) qs.set("top_id", String(params.top_id));
    if (params.sub_id) qs.set("sub_id", String(params.sub_id));
    if (params.status) qs.set("status", params.status);
    if (params.keyword) qs.set("keyword", params.keyword);
    const q = qs.toString();
    return request<AdminPageData<AdminProduct>>(`/admin/products${q ? `?${q}` : ""}`);
  },
  get: (id: number) => request<AdminProductDetail>(`/admin/products/${id}`),
  create: (body: ProductPayload) =>
    request<{ id: number }>("/admin/products", { method: "POST", body }),
  update: (id: number, body: ProductPayload) =>
    request<null>(`/admin/products/${id}`, { method: "PUT", body }),
  remove: (id: number) =>
    request<null>(`/admin/products/${id}`, { method: "DELETE" }),
  batchStatus: (ids: number[], status: "on" | "off") =>
    request<{ updated: number }>("/admin/products/batch-status", {
      method: "POST",
      body: { ids, status },
    }),
};

// ---------- 内容：品牌故事 / 时间轴 / 资讯 ----------

export interface StoryPayload {
  title: { zh: string; en: string };
  content: { zh: string; en: string };
  hero_image: string;
}

export interface TimelinePayload {
  year: number;
  title: { zh: string; en: string };
  desc: { zh: string; en: string };
  image_url: string;
  sort: number;
}

export interface ArticlePayload {
  category: "company" | "industry";
  title: { zh: string; en: string };
  summary: { zh: string; en: string };
  content: { zh: string; en: string };
  cover_url: string;
}

/** 后台资讯行（admin/articles 列表/详情） */
export interface AdminArticle {
  id: number;
  category: "company" | "industry";
  title: { zh: string; en: string };
  summary: { zh: string; en: string };
  content: { zh: string; en: string };
  cover_url: string;
  status: "draft" | "published";
  published_at: string | null;
  translation_complete: boolean;
  created_at: string;
  updated_at: string;
}

export const storyApi = {
  get: () => request<StoryPayload & { id: number }>("/admin/story"),
  save: (body: StoryPayload) => request<null>("/admin/story", { method: "PUT", body }),
};

export const timelineApi = {
  list: () => request<(TimelinePayload & { id: number })[]>("/admin/timeline"),
  create: (body: TimelinePayload) =>
    request<{ id: number }>("/admin/timeline", { method: "POST", body }),
  update: (id: number, body: TimelinePayload) =>
    request<null>(`/admin/timeline/${id}`, { method: "PUT", body }),
  remove: (id: number) =>
    request<null>(`/admin/timeline/${id}`, { method: "DELETE" }),
};

export const articleApi = {
  list: (params: {
    category?: string;
    status?: string;
    page?: number;
    page_size?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params.category) qs.set("category", params.category);
    if (params.status) qs.set("status", params.status);
    if (params.page) qs.set("page", String(params.page));
    if (params.page_size) qs.set("page_size", String(params.page_size));
    const q = qs.toString();
    return request<AdminPageData<AdminArticle>>(`/admin/articles${q ? `?${q}` : ""}`);
  },
  get: (id: number) => request<AdminArticle>(`/admin/articles/${id}`),
  create: (body: ArticlePayload) =>
    request<{ id: number }>("/admin/articles", { method: "POST", body }),
  update: (id: number, body: ArticlePayload) =>
    request<null>(`/admin/articles/${id}`, { method: "PUT", body }),
  remove: (id: number) =>
    request<null>(`/admin/articles/${id}`, { method: "DELETE" }),
  publish: (id: number) =>
    request<null>(`/admin/articles/${id}/publish`, { method: "PUT" }),
};

// ---------- M6：仪表盘 / 媒体库 / 网站配置 / 改密码 ----------

export interface DashboardStats {
  products: number;
  categories: { top: number; sub: number };
  articles: { total: number; published: number };
  banners: number;
  media: { total: number; images: number; videos: number };
  translation: { products_incomplete: number; articles_incomplete: number };
  recent_audits: {
    id: number;
    operator: string;
    action: string;
    target_type: string;
    target_id: string | null;
    detail: Record<string, unknown>;
    created_at: string;
  }[];
}

export interface MediaItem {
  id: number;
  filename: string;
  url: string;
  type: "image" | "video";
  size: number;
  created_at: string;
}

export interface BannerPayload {
  image_url: string;
  title: { zh: string; en: string };
  link_type: "product" | "article" | "url";
  link_value: string;
  sort: number;
  enabled: boolean;
}

export interface SiteConfig {
  contact: { phone: { zh: string; en: string }; email: string; address: { zh: string; en: string } };
  seo: { title: { zh: string; en: string }; description: { zh: string; en: string }; keywords: { zh: string; en: string }; og_image: string };
  switches: { show_price: boolean; show_new_tag: boolean };
  featured_products: number[];
}

export const dashboardApi = {
  stats: () => request<DashboardStats>("/admin/dashboard/stats"),
};

export const mediaApi = {
  list: (params: { page?: number; page_size?: number; type?: string }) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.page_size) qs.set("page_size", String(params.page_size));
    if (params.type) qs.set("type", params.type);
    const q = qs.toString();
    return request<AdminPageData<MediaItem>>(`/admin/media${q ? `?${q}` : ""}`);
  },
  upload: (file: File) => {
    // 上传走 FormData（不走 JSON request 封装）
    const form = new FormData();
    form.append("file", file);
    return request<{ id: number; url: string; type: string; size: number; filename: string }>(
      "/admin/media/upload",
      { method: "POST", body: form },
    );
  },
  remove: (id: number) => request<null>(`/admin/media/${id}`, { method: "DELETE" }),
};

export const bannerApi = {
  list: () => request<(BannerPayload & { id: number })[]>("/admin/banners"),
  create: (body: BannerPayload) => request<{ id: number }>("/admin/banners", { method: "POST", body }),
  update: (id: number, body: BannerPayload) => request<null>(`/admin/banners/${id}`, { method: "PUT", body }),
  remove: (id: number) => request<null>(`/admin/banners/${id}`, { method: "DELETE" }),
};

export const siteConfigApi = {
  get: () => request<SiteConfig>("/admin/site-config"),
  update: (body: Partial<SiteConfig>) => request<null>("/admin/site-config", { method: "PUT", body }),
};

export const changePassword = (old_password: string, new_password: string) =>
  request<null>("/admin/auth/change-password", {
    method: "POST",
    body: { old_password, new_password },
  });
