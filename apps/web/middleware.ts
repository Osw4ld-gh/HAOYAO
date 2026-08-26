import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// HAOYAO 语言路由中间件（middleware.ts）
// 功能：URL 语言策略 —— 中文站无前缀（/），英文站 /en 前缀。
//   - / 及无前缀路径 → 内部重写为 /zh（URL 保持原样，渲染 [lang]=zh）
//   - /en/* → 放行（[lang]=en 直接渲染）
//   - /zh/* → 302 重定向到无前缀版本（中文站规范 URL，M5 双语 SEO）
// 放行：/api（revalidate 接口）、/admin（后台，独立语言体系）、静态资源。
// 依据：技术文档 §7.5（中文站 URL 无前缀 + hreflang 使用规范 URL）。
// ============================================================================

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 放行：后台 / 内部接口 / 静态资源（不参与语言路由）
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return;
  }

  // 已有语言前缀：/zh/* 规范化重定向到无前缀；/en/* 放行
  const firstSegment = pathname.split("/")[1];
  if (firstSegment === "zh") {
    // 中文站规范 URL 无 /zh 前缀（保留查询参数）
    const url = request.nextUrl.clone();
    url.pathname = pathname === "/zh" ? "/" : pathname.slice(3);
    return NextResponse.redirect(url);
  }
  if (firstSegment === "en") {
    return;
  }

  // 其他路径（/ 或 /fragrance 等）：内部重写为中文站（URL 保持无前缀）
  const url = request.nextUrl.clone();
  url.pathname = `/zh${pathname}`;
  return NextResponse.rewrite(url);
}

// 匹配所有路径（静态资源由上面的判断放行）
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
