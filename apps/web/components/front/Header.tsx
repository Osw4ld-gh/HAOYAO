"use client";

// ============================================================================
// HAOYAO 前台主导航 Header（components/front/Header.tsx）
// 功能（CHANEL 风格 + user 最新要求）：
//   - 桌面（≥1024）：两层 header——第一行 HAOYAO（serif 大字，居中）+ lang 切换（右上，无 divider）；
//                    第二行 6 nav 居中。
//                    compact 态（scrollY > 260）：第二行 nav 收，第一行 HAOYAO 永远保持原大小（CHANEL 风不缩字号）
//   - 移动（≤1023）：site-header-grid（☰ + HAOYAO 居中）+ 汉堡抽屉
//                    compact 态：header height 64→40 + HAOYAO 字号缩（CHANEL mobile 风）
// 依据：UI 规范 §3.1 / CHANEL 风格 / PRD V1 不做会员/搜索/收藏（只保留 HAOYAO + lang + nav）
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
  // news 类型统一跳列表页 /news（不依赖 link_value，避免 seed 配置不当导致 404）
  if (node.link_type === "news") return `${prefix}/news`;
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
  const [isMobile, setIsMobile] = useState(false);

  // 当前是否 ≤767px（断点跟 globals.css 同步从 1023 降到 767，
  // 让 user 在 docked DevTools 下（viewport ≈ 800-1023）也能看到桌面 v2 spec 效果）
  // 用 window.innerWidth 而非 matchMedia：Edge DevTools docked 模式下两者不一致（视觉视口 < innerWidth），
  // 直接用 innerWidth 让 JS state 更贴近 CSS 媒体查询行为
  useEffect(() => {
    const update = () => {
      const v = window.innerWidth <= 767;
      setIsMobile(v);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // 滚动收起（v2 原型 spec：CHANEL 风格，仅 logo-row 收缩 + main-nav 收 + HAOYAO 字号缩）
  // 滞回 260/60 避免小幅滚动来回抖
  // dev 模式 debug：compact 状态变化时打 1 行日志（用户在 Chrome DevTools Console 直接看）
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setCompact((prev) => {
        if (y > 260 && !prev) {
          if (process.env.NODE_ENV === "development") {
            const h = document.querySelector(".site-header")?.getBoundingClientRect().height;
            const cls = document.querySelector(".site-header")?.className;
            console.log(`[Header scroll] compact: false → true at y=${y}, header height=${h}px, className="${cls}", isMobile=${isMobile}, innerWidth=${window.innerWidth}`);
          }
          return true;
        }
        if (y < 60 && prev) {
          if (process.env.NODE_ENV === "development") {
            const h = document.querySelector(".site-header")?.getBoundingClientRect().height;
            const cls = document.querySelector(".site-header")?.className;
            console.log(`[Header scroll] compact: true → false at y=${y}, header height=${h}px, className="${cls}", isMobile=${isMobile}, innerWidth=${window.innerWidth}`);
          }
          return false;
        }
        return prev;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isMobile]);

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

  // 语言切换：点击 .topbar-lang-btn 直接跳到等价路由（保留当前页面路径）
  const switchLocale = (target: "zh" | "en") => {
    if (target === locale) return;
    window.location.href = languageHref(pathname, target);
  };

  // className 组合（CHANEL 风格：所有断点都 sticky + 内容缩，不整条 translateY 滑出）：
  //   - always: site-header
  //   - compact: ".compact"（桌面：logo-row padding 缩 + HAOYAO 字号缩 + 副标题收 + main-nav 收；
  //                          移动：site-header-grid height 缩 + HAOYAO 字号缩）
  const headerClass = [
    "site-header",
    compact ? "compact" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const homeHref = locale === "en" ? "/en" : "/";

  return (
    <>
      {/* 主导航栏：sticky 始终显示；滚动 ≥260 触发 .compact（CHANEL 风格：内容缩，不整条滑出）
          - 桌面（≥1024）：v2 风格 logo-row（lang 左 + HAOYAO 居中 + 副标题下）+ main-nav 居中
                          → logo-row padding 22-18→10-0 + HAOYAO 字号 28→20 + 副标题 max-height 0 + main-nav max-height 0
          - 移动（≤1023）：site-header-grid（☰ + HAOYAO）→ height 64→40 + HAOYAO 字号缩 */}
      <header
        className={headerClass}
        style={{
          position: "sticky",
          top: 0,
          zIndex: "var(--z-nav)",
          background: "rgba(247,244,239,0.96)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid var(--line)",
          transition:
            "box-shadow 0.3s var(--ease-brand)",
          boxShadow: compact ? "0 6px 18px -10px rgba(25,25,24,0.18)" : "none",
        }}
      >
        {/* ============ 桌面（≥1024）CHANEL 风格 header ============ */}
        {/* 结构：两行
            第一行 .header-row：HAOYAO（serif大字，居中）+ lang 切换（紧贴右上，无 divider）
            第二行 .main-nav：6 nav 居中
            compact 态（CHANEL 风）：第二行收，第一行 HAOYAO 永远保持原大小（CHANEL 风不缩字号） */}
        <div className="header-row">
          <Link href={homeHref} className="logo" aria-label="HAOYAO Home">
            HAOYAO
          </Link>
          <div className="header-tools" aria-label="Language">
            <button
              className={`header-lang-btn ${locale === "zh" ? "is-active" : ""}`}
              onClick={() => switchLocale("zh")}
              data-lang="zh"
              type="button"
            >
              中文
            </button>
            <span className="header-lang-div" aria-hidden="true" />
            <button
              className={`header-lang-btn ${locale === "en" ? "is-active" : ""}`}
              onClick={() => switchLocale("en")}
              data-lang="en"
              type="button"
            >
              EN
            </button>
          </div>
        </div>
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <Link
              key={item.id}
              href={resolveHref(item, locale)}
              className="main-nav-link"
            >
              {locale === "en" ? item.label.en || item.label.zh : item.label.zh}
            </Link>
          ))}
        </nav>

        {/* ============ 移动（≤1023）：☰ + HAOYAO 居中（v2 prototype mobile-drawer 替代品） ============ */}
        <div
          className="site-header-grid"
          style={{
            maxWidth: "var(--container-max)",
            margin: "0 auto",
            padding: "0 var(--container-pad)",
            display: "flex",
            alignItems: "center",
            gap: 16,
            height: 64,
            position: "relative",
          }}
        >
          {/* ☰ 汉堡按钮（order:-1 紧贴最左） */}
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
          {/* HAOYAO logo 居中（绝对定位 left:50% translateX(-50%)——精准居中，无视 flex 行为） */}
          <Link
            href={homeHref}
            className="brand-logo"
            style={{
              whiteSpace: "nowrap",
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
            }}
          >
            HAOYAO
          </Link>
        </div>
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
