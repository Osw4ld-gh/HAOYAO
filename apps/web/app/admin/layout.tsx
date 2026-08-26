import AuthGuard from "@/components/admin/AuthGuard";
import Sidebar from "@/components/admin/Sidebar";

// ============================================================================
// HAOYAO 后台布局（app/admin/layout.tsx）
// 功能：后台主框架 —— 深色侧栏 + 内容区（顶栏由各页面渲染，便于标题随模块变化）。
// 依据：UI 规范 §4.1 主框架（侧栏 220px 深色 + 内容区 padding 28px 32px 60px）。
// ============================================================================

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="admin-root"
      style={{ display: "flex", minHeight: "100vh", background: "var(--bg-admin)" }}
    >
      <Sidebar />
      {/* 登录守卫：未登录重定向 /admin/login */}
      <AuthGuard>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          {children}
        </div>
      </AuthGuard>
    </div>
  );
}
