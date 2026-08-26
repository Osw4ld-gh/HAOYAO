// ============================================================================
// HAOYAO 前台通用小组件（components/front/Ui.tsx）
// 功能：TabBar（二级分类切换）、Breadcrumb（面包屑）、Pagination（分页）。
// 依据：UI 规范 §3.4 Tab / §3.7 面包屑 / §3.8 分页（前台 12/页）。
// ============================================================================

import Link from "next/link";

import { t } from "@/lib/i18n";

// ---------------------------------------------------------------------------
// TabBar：二级分类切换（列表页顶部，点击直达二级分类）
// ---------------------------------------------------------------------------

export interface TabItem {
  label: string;
  href: string;
  active: boolean;
}

export function TabBar({ items }: { items: TabItem[] }) {
  return (
    <nav style={{ display: "flex", gap: 28, overflowX: "auto", borderBottom: "1px solid var(--line)" }}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          style={{
            padding: "12px 2px",
            fontSize: 14,
            letterSpacing: "0.12em",
            color: item.active ? "var(--ink)" : "var(--ink-3)",
            borderBottom: `2px solid ${item.active ? "var(--gold)" : "transparent"}`,
            marginBottom: -1,
            whiteSpace: "nowrap",
            transition: "color var(--dur-hover)",
          }}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Breadcrumb：面包屑（首页 / 分类 / 产品）
// ---------------------------------------------------------------------------

export interface Crumb {
  label: string;
  href?: string; // 缺省为当前页（纯文本）
}

export function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-3)", letterSpacing: "0.06em" }}>
      {crumbs.map((crumb, i) => (
        <span key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {i > 0 && <span style={{ color: "var(--line)" }}>/</span>}
          {crumb.href ? (
            <Link href={crumb.href} style={{ color: "var(--ink-2)" }}>
              {crumb.label}
            </Link>
          ) : (
            <span style={{ color: "var(--ink)" }}>{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Pagination：分页（Link 驱动，服务端组件友好；?page=N query）
// ---------------------------------------------------------------------------

interface PaginationProps {
  page: number;
  totalPages: number;
  /** 基础路径（不含 ?page 参数），如 /skincare/serum */
  baseHref: string;
  locale: "zh" | "en";
}

export function Pagination({ page, totalPages, baseHref, locale }: PaginationProps) {
  if (totalPages <= 1) return null;
  const prefix = locale === "en" ? "/en" : "";
  // 分页链接：保留查询参数（page=1 时省略，保持 URL 干净）
  // 分页链接：兼容 baseHref 已含 query（如 /news?category=company），用 URLSearchParams 合并 page
  const hrefFor = (target: number) => {
    const [path, qs = ""] = baseHref.split("?");
    const params = new URLSearchParams(qs);
    if (target > 1) params.set("page", String(target));
    else params.delete("page");
    const q = params.toString();
    return `${prefix}${path}${q ? `?${q}` : ""}`;
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 48 }}>
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} style={{ padding: "6px 14px", border: "1px solid var(--line)", fontSize: 13, color: "var(--ink-2)" }}>
          {t("common.prev", locale)}
        </Link>
      ) : (
        <span style={{ padding: "6px 14px", border: "1px solid var(--line)", fontSize: 13, color: "var(--ink-3)", opacity: 0.4 }}>
          {t("common.prev", locale)}
        </span>
      )}
      <span style={{ fontSize: 13, color: "var(--ink-2)", letterSpacing: "0.1em" }}>
        {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} style={{ padding: "6px 14px", border: "1px solid var(--line)", fontSize: 13, color: "var(--ink-2)" }}>
          {t("common.next", locale)}
        </Link>
      ) : (
        <span style={{ padding: "6px 14px", border: "1px solid var(--line)", fontSize: 13, color: "var(--ink-3)", opacity: 0.4 }}>
          {t("common.next", locale)}
        </span>
      )}
    </div>
  );
}
