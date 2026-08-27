"use client";

// ============================================================================
// HAOYAO 前台主导航 Header（components/front/Header.tsx）
// 功能：
//   - 品牌 + 主导航（点击直达，无 hover 下拉——PRD V1.2 决策）+ 语言切换
//   - 滚动收起：scrollY > 260 收起 / < 60 恢复，180ms 过渡（原型 v2 宽滞回参数）
//   - 移动端：汉堡按钮 → 侧滑抽屉（平级列表，锁定滚动）
// 依据：UI 规范 §3.1 导航 / 原型 v2；导航数据由 [lang]/layout（服务端）传入。
// ============================================================================

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { t } from "@/lib/i18n";
import type { NavNode } from "@/lib/api/types";

interface HeaderProps {
  /** 主导航树（服务端已拉取，SSR 实时） */
  navItems: NavNode[];
  /** 当前语言（zh/en） */
  locale: "zh" | "en";
}

/** 根据链接类型生成目标 URL（英文站加 /en 前缀，保持等价路由） */
function resolveHref(node: NavNode, locale: "zh" | "en"): string {
  const prefix = locale === "en" ? "/en" : "";
  if (node.link_type === "url") return node.link_value; // 外部 URL 不加前缀
  if (node.link_type === "home") return prefix || "/";
  return `${prefix}/${node.link_value}`;
}

/** 语言切换目标：保留当前等价路由（/path ↔ /en/path） */
function languageHref(pathname: string, locale: "zh" | "en"): string {
  if (locale === "en") {
    // 英文 → 中文：去掉 /en 前缀
    return pathname.startsWith("/en") ? pathname.slice(3) || "/" : pathname;
  }
  // 中文 → 英文：加上 /en 前缀
  return pathname === "/" ? "/en" : `/en${pathname}`;
}

export default function Header({ navItems, locale }: HeaderProps) {
  const pathname = usePathname();
  const [compact, setCompact] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 滚动收起（v2 原型 + CHANEL 风格）
  // - 桌面端：滚动 ≥260 → compact 态，第二行导航收起，header 仍 sticky 显示
  // - 移动端：compact 态叠加 is-mobile-hidden 类，整条 header 向上收起
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      // 宽滞回（260/60）避免抖动
      setCompact((prev) => {
        if (y > 260 && !prev) return true;
        if (y < 60 && prev) return false;
        return prev;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // 抽屉开启时锁定页面滚动
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  return (
    <>
      {/* 主导航栏：sticky 始终显示；滚动 ≥260 触发 .compact（桌面仅收起第二行 nav；移动端整条收起） */}
      <header
        className={`site-header ${compact ? "compact" : ""}`}
        style={{
          position: "sticky",
          top: 0,
          zIndex: "var(--z-nav)",
          background: "rgba(247,244,239,0.96)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid var(--line)",
          transition:
            "box-shadow 0.3s var(--ease-brand), transform var(--dur-nav) var(--ease-brand)",
          boxShadow: compact ? "0 6px 18px -10px rgba(25,25,24,0.18)" : "none",
        }}
      >
        <div
          className="site-header-grid"
          style={{
            maxWidth: "var(--container-max)",
            margin: "0 auto",
            padding: "0 var(--container-pad)",
            display: "flex",
            alignItems: "center",
            gap: 16,
            height: 72,
            position: "relative",
          }}
        >
          {/* col 1：桌面端——语言切换（紧贴 HAOYAO 左侧）；
              ≤1024px——隐藏（语言切换进抽屉） */}
          <Link
            href={languageHref(pathname, locale)}
            className="header-lang"
            style={{
              fontSize: 12,
              letterSpacing: "0.2em",
              color: "var(--ink-2)",
              whiteSpace: "nowrap",
              justifySelf: "start",
            }}
          >
            {t("nav.switchTo", locale)}
          </Link>

          {/* HAOYAO logo 居中（绝对定位 left:50% translateX(-50%)——精准居中，无视 flex 行为） */}
          <Link
            href={locale === "en" ? "/en" : "/"}
            style={{
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "0.28em",
              whiteSpace: "nowrap",
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
            }}
          >
            HAOYAO
          </Link>

          {/* col 3 占位（桌面 nav 已移至第二行 .desktop-nav-row，避免重复渲染） */}

          {/* 移动端/平板端（≤1024px）汉堡按钮（order:-1 排到 HAOYAO 之前——紧贴最左） */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="mobile-menu-btn"
            style={{
              fontSize: 22,
              padding: 8,
              order: -1,
            }}
            aria-label={t("nav.openMenu", locale)}
          >
            ☰
          </button>
        </div>

        {/* 桌面端第二行：导航（CHANEL 风格；位于 HAOYAO 下方居中；≤1024px 隐藏） */}
        <nav
          className="desktop-nav-row"
          style={{
            maxWidth: "var(--container-max)",
            margin: "0 auto",
            padding: "0 var(--container-pad) 14px",
            display: "flex",
            justifyContent: "center",
            gap: 32,
            borderBottom: "1px solid var(--line)",
          }}
        >
          {navItems.map((item) => (
            <Link
              key={item.id}
              href={resolveHref(item, locale)}
              style={{
                fontSize: 14,
                letterSpacing: "0.16em",
                color: "var(--ink)",
                whiteSpace: "nowrap",
                borderBottom: "2px solid transparent",
                paddingBottom: 4,
                transition: "color var(--dur-hover) var(--ease-brand)",
              }}
            >
              {locale === "en" ? item.label.en || item.label.zh : item.label.zh}
            </Link>
          ))}
        </nav>
      </header>

      {/* 移动端抽屉（平级列表，无手风琴——PRD V1.2 决策） */}
      {drawerOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: "var(--z-drawer)",
            background: "rgba(25,25,24,0.4)",
          }}
          onClick={() => setDrawerOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              bottom: 0,
              width: "min(320px, 80vw)",
              background: "var(--bg)",
              boxShadow: "var(--shadow-drawer)",
              padding: "24px 28px",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", marginBottom: 24, gap: 16 }}>
              <span style={{ fontSize: 18, letterSpacing: "0.28em", fontWeight: 600 }}>HAOYAO</span>
              {/* 语言切换紧贴 HAOYAO 右侧（HAOYAO 同排） */}
              <Link
                href={languageHref(pathname, locale)}
                onClick={() => setDrawerOpen(false)}
                style={{ fontSize: 12, letterSpacing: "0.2em", color: "var(--ink-2)" }}
              >
                {t("nav.switchTo", locale)}
              </Link>
              <button
                onClick={() => setDrawerOpen(false)}
                style={{ fontSize: 22, marginLeft: "auto" }}
                aria-label={t("nav.closeMenu", locale)}
              >
                ×
              </button>
            </div>
            <nav style={{ display: "flex", flexDirection: "column" }}>
              {navItems.map((item) => (
                <Link
                  key={item.id}
                  href={resolveHref(item, locale)}
                  onClick={() => setDrawerOpen(false)}
                  style={{
                    padding: "14px 0",
                    fontSize: 16,
                    letterSpacing: "0.12em",
                    borderBottom: "1px solid var(--line)",
                  }}
                >
                  {locale === "en" ? item.label.en || item.label.zh : item.label.zh}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
