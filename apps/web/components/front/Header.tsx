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
  const [hidden, setHidden] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 滚动收起（260/60 宽滞回 + 180ms 过渡，原型 v2 参数）
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      // 260/60 宽滞回：越过阈值才切换，避免快速滚动抖动
      if (y > 260) setHidden(true);
      else if (y < 60) setHidden(false);
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
      {/* 主导航栏：滚动时向上收起 */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: "var(--z-nav)",
          background: "rgba(247,244,239,0.96)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid var(--line)",
          transform: hidden ? "translateY(-100%)" : "translateY(0)",
          transition: "transform var(--dur-nav) var(--ease-brand)",
        }}
      >
        <div
          className="site-header-grid"
          style={{
            maxWidth: "var(--container-max)",
            margin: "0 auto",
            padding: "0 var(--container-pad)",
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            alignItems: "center",
            gap: 24,
            height: 72,
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

          {/* col 2：HAOYAO logo 居中 */}
          <Link
            href={locale === "en" ? "/en" : "/"}
            style={{
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "0.28em",
              whiteSpace: "nowrap",
              justifySelf: "center",
            }}
          >
            HAOYAO
          </Link>

          {/* col 3：≥1024px——桌面端 nav（CHANEL 风格；justifySelf: end 靠右但与 logo 紧贴）
              ≤1024px——由 globals hidden，nav 移到第二行/抽屉 */}
          <nav
            className="desktop-nav"
            style={{
              display: "flex",
              gap: 28,
              justifySelf: "end",
              alignItems: "center",
            }}
          >
            {navItems.map((item) => (
              <Link
                key={item.id}
                href={resolveHref(item, locale)}
                style={{
                  fontSize: 13,
                  letterSpacing: "0.14em",
                  color: "var(--ink)",
                  whiteSpace: "nowrap",
                  borderBottom: "2px solid transparent",
                  transition: "color var(--dur-hover) var(--ease-brand)",
                }}
              >
                {locale === "en" ? item.label.en || item.label.zh : item.label.zh}
              </Link>
            ))}
          </nav>

          {/* 移动端/平板端（≤1024px）汉堡按钮（gridColumn 3 占据 nav 位置） */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="mobile-menu-btn"
            style={{
              fontSize: 22,
              padding: 8,
              gridColumn: 3,
              justifySelf: "start",
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
