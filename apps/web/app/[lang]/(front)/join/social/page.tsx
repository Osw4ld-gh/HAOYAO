import type { Metadata } from "next";

import { t } from "@/lib/i18n";
import { Breadcrumb } from "@/components/front/Ui";

// ============================================================================
// HAOYAO 加入我们（静态占位，V1 不投递）
// 功能：{t("join.social", locale)} / 校园招聘 两页共用占位 —— 提示"招聘渠道筹备中"。
// 说明：方案 §4-M4 —— 加入我们页为前端静态占位，不接后端接口、无投递功能。
// ============================================================================

export const metadata: Metadata = { title: "加入我们" };

interface JoinPageProps {
  params: Promise<{ lang: string }>;
}

export default async function JoinSocialPage({ params }: JoinPageProps) {
  const { lang } = await params;
  const locale = lang === "en" ? "en" : "zh";
  const prefix = locale === "en" ? "/en" : "";

  return (
    <div style={{ maxWidth: "var(--container-max)", margin: "0 auto", padding: "48px var(--container-pad) 96px" }}>
      <Breadcrumb crumbs={[{ label: t("common.home", locale), href: prefix || "/" }, { label: locale === "en" ? "Join Us" : "加入我们" }]} />
      <h1 style={{ margin: "24px 0 8px", fontSize: "var(--fs-h1)", fontWeight: 400, letterSpacing: "0.2em", color: "var(--ink)" }}>
        {t("join.social", locale)}
      </h1>
      <p style={{ marginTop: 40, fontSize: 15, lineHeight: 2, color: "var(--ink-2)" }}>
        {t("join.socialPlaceholder", locale)}
      </p>
    </div>
  );
}
