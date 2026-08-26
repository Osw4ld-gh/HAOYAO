import type { Metadata } from "next";

import { t } from "@/lib/i18n";
import { Breadcrumb } from "@/components/front/Ui";

// ============================================================================
// HAOYAO 隐私声明页（app/[lang]/(front)/privacy/page.tsx，静态）
// 功能：网站隐私声明（静态文案占位，正式文本 M8 上线前由法务确认）。
// 说明：方案 §4-M4 —— 隐私声明为页脚入口的静态页（14 页 + 本页 = 15 页）。
// ============================================================================

export const metadata: Metadata = { title: "隐私声明" };

interface PrivacyPageProps {
  params: Promise<{ lang: string }>;
}

export default async function PrivacyPage({ params }: PrivacyPageProps) {
  const { lang } = await params;
  const locale = lang === "en" ? "en" : "zh";
  const prefix = locale === "en" ? "/en" : "";

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px var(--container-pad) 96px" }}>
      <Breadcrumb crumbs={[{ label: t("common.home", locale), href: prefix || "/" }, { label: t("privacy.title", locale) }]} />
      <h1 style={{ margin: "24px 0 32px", fontSize: "var(--fs-h1)", fontWeight: 400, letterSpacing: "0.2em", color: "var(--ink)" }}>
        {t("privacy.title", locale)}
      </h1>

      <div style={{ fontSize: 15, lineHeight: 2, color: "var(--ink-2)" }}>
        <h2 style={{ margin: "28px 0 8px", fontSize: 17, fontWeight: 500, color: "var(--ink)" }}>
          {t("privacy.s1Title", locale)}
        </h2>
        <p>
          {locale === "en"
            ? t("privacy.s1Body", locale)
            : t("privacy.s1Body", locale)}
        </p>

        <h2 style={{ margin: "28px 0 8px", fontSize: 17, fontWeight: 500, color: "var(--ink)" }}>
          {t("privacy.s2Title", locale)}
        </h2>
        <p>
          {locale === "en"
            ? t("privacy.s2Body", locale)
            : t("privacy.s2Body", locale)}
        </p>

        <h2 style={{ margin: "28px 0 8px", fontSize: 17, fontWeight: 500, color: "var(--ink)" }}>
          {t("privacy.s3Title", locale)}
        </h2>
        <p>
          {locale === "en"
            ? t("privacy.s3Body", locale)
            : t("privacy.s3Body", locale)}
        </p>

        <p style={{ marginTop: 40, fontSize: 13, color: "var(--ink-3)" }}>
          {locale === "en"
            ? t("privacy.note", locale)
            : t("privacy.note", locale)}
        </p>
      </div>
    </div>
  );
}
