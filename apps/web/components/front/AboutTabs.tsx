"use client";

// ============================================================================
// HAOYAO 关于页 Tab（components/front/AboutTabs.tsx）
// 功能：品牌故事 / 发展历程 / 联系我们 三页 Tab，当前页高亮（usePathname 判断）。
// 依据：PRD V1.2 —— 关于页三页统一 Tab。
// ============================================================================

import Link from "next/link";
import { usePathname } from "next/navigation";

interface AboutTabsProps {
  locale: "zh" | "en";
}

export default function AboutTabs({ locale }: AboutTabsProps) {
  const pathname = usePathname();
  const prefix = locale === "en" ? "/en" : "";

  const tabs = [
    { href: `${prefix}/about/story`, label: locale === "en" ? "Brand Story" : "品牌故事" },
    { href: `${prefix}/about/history`, label: locale === "en" ? "History" : "发展历程" },
    { href: `${prefix}/about/contact`, label: locale === "en" ? "Contact Us" : "联系我们" },
  ];

  return (
    <nav
      style={{
        display: "flex",
        justifyContent: "center",
        gap: 40,
        borderBottom: "1px solid var(--line)",
        marginBottom: 48,
      }}
    >
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              padding: "12px 4px",
              fontSize: 14,
              letterSpacing: "0.14em",
              color: active ? "var(--ink)" : "var(--ink-3)",
              borderBottom: `2px solid ${active ? "var(--gold)" : "transparent"}`,
              marginBottom: -1,
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
