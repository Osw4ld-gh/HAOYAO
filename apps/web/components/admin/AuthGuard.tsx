"use client";

// ============================================================================
// HAOYAO 后台登录守卫（components/admin/AuthGuard.tsx）
// 功能：客户端检查 access_token，未登录时重定向到 /admin/login。
// 说明：token 存 localStorage，SSR 期间不可见，故守卫放在客户端组件
//       useEffect 中执行（首帧渲染后检查）。
// ============================================================================

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { getAccessToken } from "@/lib/admin/client";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // 登录页自身放行（否则重定向死循环）
    if (pathname === "/admin/login") {
      setReady(true);
      return;
    }
    // 首帧后检查登录态（避免 SSR 时访问 localStorage）
    if (!getAccessToken()) {
      router.replace("/admin/login");
      return;
    }
    setReady(true);
  }, [pathname, router]);

  // 未就绪（检查中）渲染空白，避免闪现后台内容
  if (!ready) return null;
  return <>{children}</>;
}
