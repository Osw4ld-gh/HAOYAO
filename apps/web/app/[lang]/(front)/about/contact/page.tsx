import type { Metadata } from "next";

import { t } from "@/lib/i18n";
import { fetchPublic } from "@/lib/api/client";

// ============================================================================
// HAOYAO 联系我们页（app/[lang]/(front)/about/contact/page.tsx，SSG）
// 功能：两栏信息（电话/邮箱/地址）+ 占位提示（正式表单/地图占位，V1 纯展示）。
// 依据：PRD §3.2 联系我们页 / 技术文档 §7.1（SSG /contact）。
// ============================================================================

export const metadata: Metadata = { title: "联系我们" };

interface ContactPageProps {
  params: Promise<{ lang: string }>;
}

export default async function ContactPage({ params }: ContactPageProps) {
  const { lang } = await params;
  const locale = lang === "en" ? "en" : "zh";

  const contact = await fetchPublic<{
    phone: { zh: string; en: string };
    email: string;
    address: { zh: string; en: string };
  }>("/contact").catch(() => null);

  const phone = contact ? (locale === "en" ? contact.phone.en || contact.phone.zh : contact.phone.zh) : "";
  const address = contact ? (locale === "en" ? contact.address.en || contact.address.zh : contact.address.zh) : "";
  const email = contact?.email ?? "";

  return (
    <div style={{ paddingBottom: 96 }}>
      <div style={{ textAlign: "center", padding: "24px 24px 56px" }}>
        <h1 style={{ fontSize: "var(--fs-h1)", fontWeight: 400, letterSpacing: "0.2em", color: "var(--ink)" }}>
          {t("about.contactUs", locale)}
        </h1>
      </div>

      {/* 两栏信息 */}
      <div style={{ display: "grid", gridTemplateColumns: "var(--grid-2col)", gap: 48, maxWidth: 800, margin: "0 auto" }}>
        <div>
          <InfoBlock label={t("about.phone", locale)} value={phone || "—"} />
          <InfoBlock label={t("about.email", locale)} value={email || "—"} />
          <InfoBlock label={t("about.address", locale)} value={address || "—"} />
        </div>
        {/* 占位提示（正式表单/地图 V1 不交付） */}
        <div
          style={{
            border: "1px dashed var(--line)",
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 200,
            color: "var(--ink-3)",
            fontSize: 13,
            letterSpacing: "0.1em",
          }}
        >
          {t("about.placeholder", locale)}
        </div>
      </div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "18px 0", borderBottom: "1px solid var(--line)" }}>
      <div style={{ fontSize: 12, letterSpacing: "0.2em", color: "var(--gold-deep)" }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 16, letterSpacing: "0.06em", color: "var(--ink)" }}>{value}</div>
    </div>
  );
}
