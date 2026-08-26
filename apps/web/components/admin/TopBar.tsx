"use client";

// ============================================================================
// HAOYAO 后台顶栏（components/admin/TopBar.tsx）
// 功能：顶栏 —— 当前模块标题 + 退出登录。
// 说明：退出调用 authApi.logout（清除 Refresh Cookie）后清除本地 token
//       并跳转登录页。
// ============================================================================

import { useRouter } from "next/navigation";

import { authApi, setAccessToken } from "@/lib/admin/client";

export default function TopBar({ title }: { title: string }) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // 退出接口失败不阻塞本地清理（token 本地失效即可）
    }
    setAccessToken(null);
    router.replace("/admin/login");
  };

  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0 32px",
        height: 56,
        borderBottom: "1px solid var(--line)",
        background: "#fff",
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 500, letterSpacing: "0.08em" }}>{title}</div>
      <button
        onClick={handleLogout}
        style={{ fontSize: 13, color: "var(--ink-2)", padding: "6px 12px", borderRadius: 4 }}
      >
        退出登录
      </button>
    </header>
  );
}
