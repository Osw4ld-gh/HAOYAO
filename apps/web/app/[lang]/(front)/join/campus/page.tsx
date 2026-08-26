import type { Metadata } from "next";

import { Breadcrumb } from "@/components/front/Ui";
import { t } from "@/lib/i18n";

// ============================================================================
// HAOYAO 加入我们 —— 校园招聘（静态占位，V1 不投递）
// 功能：占位提示，无后端接口、无投递功能（方案 §4-M4）。
// ============================================================================

export const metadata: Metadata = { title: "校园招聘" };

interface JoinPageProps {
  params: Promise<{ lang: string }>;
}

export default async function JoinCampusPage({ params }: JoinPageProps) {
  const { lang } = await params;
  const locale = lang === "en" ? "en" : "zh";
  const prefix = locale === "en" ? "/en" : "";

  return (
    <div style={{ maxWidth: "var(--container-max)", margin: "0 auto", padding: "48px var(--container-pad) 96px" }}>
      <Breadcrumb crumbs={[{ label: t("common.home", locale), href: prefix || "/" }, { label: t("join.title", locale) }]} />
      <h1 style={{ margin: "24px 0 8px", fontSize: "var(--fs-h1)", fontWeight: 400, letterSpacing: "0.2em", color: "var(--ink)" }}>
        {t("join.campus", locale)}
      </h1>
      <p style={{ marginTop: 40, fontSize: 15, lineHeight: 2, color: "var(--ink-2)" }}>
        {t("join.campusPlaceholder", locale)}
      </p>
    </div>
  );
}
