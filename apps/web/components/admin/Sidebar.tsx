"use client";

// ============================================================================
// HAOYAO 后台侧栏（components/admin/Sidebar.tsx）
// 功能：深色侧栏导航（UI 规范 §4.1 主框架）——品牌区 + 模块菜单。
// 说明：M2 启用「导航配置」「产品管理」；其余模块（仪表盘/内容/媒体/配置）
//       在 M4/M6 阶段挂载，当前显示为禁用态占位。
// ============================================================================

import Link from "next/link";
import { usePathname } from "next/navigation";

interface MenuItem {
  key: string;
  label: string;
  href: string;
  enabled: boolean;
}

const MENU: MenuItem[] = [
  { key: "dashboard", label: "仪表盘", href: "/admin/dashboard", enabled: true },
  { key: "navigation", label: "导航配置", href: "/admin/navigation", enabled: true },
  { key: "products", label: "产品管理", href: "/admin/products", enabled: true },
  { key: "content", label: "内容管理", href: "/admin/content", enabled: true },
  { key: "media", label: "媒体库", href: "/admin/media", enabled: true },
  { key: "config", label: "网站配置", href: "/admin/config", enabled: true },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: 220,
        flexShrink: 0,
        background: "var(--side-bg)",
        color: "var(--side-ink)",
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
      }}
    >
      {/* 品牌区 */}
      <div
        style={{
          padding: "20px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          letterSpacing: "0.28em",
          fontSize: 16,
          fontWeight: 600,
          color: "#fff",
        }}
      >
        HAOYAO
        <div style={{ fontSize: 11, letterSpacing: "0.2em", color: "var(--side-ink)", marginTop: 4 }}>
          皓遥 · 内容管理
        </div>
      </div>

      {/* 模块菜单 */}
      <nav style={{ flex: 1, padding: "16px 12px" }}>
        {MENU.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <div key={item.key} style={{ marginBottom: 4 }}>
              {item.enabled ? (
                <Link
                  href={item.href}
                  style={{
                    display: "block",
                    padding: "10px 14px",
                    borderRadius: 4,
                    fontSize: 14,
                    letterSpacing: "0.06em",
                    color: active ? "var(--side-active)" : "var(--side-ink)",
                    background: active ? "rgba(255,255,255,0.08)" : "transparent",
                  }}
                >
                  {item.label}
                </Link>
              ) : (
                <div
                  style={{
                    padding: "10px 14px",
                    fontSize: 14,
                    letterSpacing: "0.06em",
                    color: "rgba(201,194,182,0.35)",
                    cursor: "not-allowed",
                  }}
                  title="后续里程碑开放"
                >
                  {item.label}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div style={{ padding: "16px 24px", fontSize: 11, color: "rgba(201,194,182,0.4)" }}>
        © 2026 HAOYAO
      </div>
    </aside>
  );
}
