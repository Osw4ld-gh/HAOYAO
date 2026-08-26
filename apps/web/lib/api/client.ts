// ============================================================================
// HAOYAO 前台 API 客户端（lib/api/client.ts）
// 功能：前台公开接口的 fetch 封装（无鉴权）。
// 说明：
//   - 前台页面为 SSR/ISR，本客户端在服务端组件中直接调用（可访问后端内网地址）
//   - ISR 缓存：通过 next.revalidate（秒）与 revalidateTag（后台写操作通知刷新）
//   - 依据《开发技术文档》§7.4：前台接口无鉴权，错误按统一响应包处理
// ============================================================================

import type { ApiResponse } from "./types";

// 后端地址：服务端渲染时用内网地址（Docker 内 http://api:8000），开发默认 localhost
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000/api/v1";

/** 前台接口请求选项（ISR 缓存策略） */
export interface PublicFetchOptions {
  /** ISR 缓存时长（秒）；不传则不缓存（SSR 实时） */
  revalidate?: number;
  /** revalidateTag 标签（后台写操作经 /api/revalidate 刷新） */
  tags?: string[];
}

/** 前台 API 错误（含业务 code） */
export class PublicApiError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * 前台接口请求：返回统一响应包的 data 部分。
 *
 * 用法（服务端组件）：
 *   const home = await fetchPublic<HomeData>("/home", { revalidate: 60 });
 */
export async function fetchPublic<T>(
  path: string,
  options: PublicFetchOptions = {},
): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, {
    // ISR：revalidate 秒数 + tags（配合 revalidateTag 精确刷新）
    next: {
      revalidate: options.revalidate ?? 0,
      tags: options.tags,
    },
  });

  if (!resp.ok) {
    throw new PublicApiError(resp.status, `接口请求失败（${resp.status}）`);
  }

  const envelope = (await resp.json()) as ApiResponse<T>;
  if (envelope.code !== 0) {
    throw new PublicApiError(envelope.code, envelope.message || "请求失败");
  }
  return envelope.data as T;
}
