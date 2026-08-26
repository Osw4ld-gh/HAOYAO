// ============================================================================
// HAOYAO 前台页脚 Footer（components/front/Footer.tsx）
// 功能：4 列页脚 —— 品牌 / 加入我们 / 关于 HAOYAO / 客户服务（PRD §4.5 决策）。
// 说明：M3 为静态链接占位；M4 接入 site_setting.contact 动态数据。
// ============================================================================

import Link from "next/link";

import { t } from "@/lib/i18n";

interface FooterProps {
  locale: "zh" | "en";
}

const isEn = (locale: "zh" | "en") => locale === "en";

export default function Footer({ locale }: FooterProps) {
  return (
    <footer
      style={{
        background: "var(--hero-1)",
        color: "var(--side-ink)",
        marginTop: "var(--section-gap)",
      }}
    >
      <div
        style={{
          maxWidth: "var(--container-max)",
          margin: "0 auto",
          padding: "64px var(--container-pad) 40px",
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr 1fr",
          gap: 48,
        }}
      >
        {/* 品牌列 */}
        <div>
          <div style={{ fontSize: 20, letterSpacing: "0.28em", fontWeight: 600, color: "#fff" }}>
            HAOYAO
          </div>
          <div style={{ fontSize: 12, letterSpacing: "0.2em", color: "var(--gold-soft)", margin: "12px 0 20px" }}>
            皓启纯净，遥见本真
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.8, color: "var(--side-ink)", maxWidth: 280 }}>
            {t("footer.brandDesc", locale)}
          </p>
        </div>

        {/* 加入我们 */}
        <div>
          <div style={{ fontSize: 13, letterSpacing: "0.2em", marginBottom: 16, color: "#fff" }}>
            {isEn(locale) ? t("footer.join", locale).toUpperCase() : t("footer.join", locale)}
          </div>
          <FooterLink locale={locale} en="/en/join/social" zh="/join/social" label={t("footer.socialRecruit", locale)} />
          <FooterLink locale={locale} en="/en/join/campus" zh="/join/campus" label={t("footer.campusRecruit", locale)} />
        </div>

        {/* 关于 HAOYAO */}
        <div>
          <div style={{ fontSize: 13, letterSpacing: "0.2em", marginBottom: 16, color: "#fff" }}>
            {isEn(locale) ? t("footer.about", locale).toUpperCase() : t("footer.about", locale)}
          </div>
          <FooterLink locale={locale} en="/en/about/story" zh="/about/story" label={t("footer.brandStory", locale)} />
          <FooterLink locale={locale} en="/en/about/history" zh="/about/history" label={t("footer.history", locale)} />
          <FooterLink locale={locale} en="/en/about/contact" zh="/about/contact" label={t("footer.contactUs", locale)} />
        </div>

        {/* 客户服务 */}
        <div>
          <div style={{ fontSize: 13, letterSpacing: "0.2em", marginBottom: 16, color: "#fff" }}>
            {isEn(locale) ? t("footer.service", locale).toUpperCase() : t("footer.service", locale)}
          </div>
          <div style={{ fontSize: 13, lineHeight: 2.2, color: "var(--side-ink)" }}>
            {isEn(locale) ? "service@haoyao.com" : "service@haoyao.com"}
            <br />
            {t("footer.serviceHours", locale)}
          </div>
        </div>
      </div>

      {/* 版权条 */}
      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.08)",
          padding: "20px var(--container-pad)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          fontSize: 12,
          color: "rgba(201,194,182,0.5)",
        }}
      >
        <span>{t("footer.copyright", locale)}</span>
        <span>{t("footer.icp", locale)}</span>
        <Link href={isEn(locale) ? "/en/privacy" : "/privacy"} style={{ color: "inherit" }}>
          {t("footer.privacy", locale)}
        </Link>
      </div>
    </footer>
  );
}

/** 页脚链接行（等价路由） */
function FooterLink({
  locale,
  en,
  zh,
  label,
}: {
  locale: "zh" | "en";
  en: string;
  zh: string;
  label: string;
}) {
  return (
    <Link
      href={locale === "en" ? en : zh}
      style={{
        display: "block",
        fontSize: 13,
        lineHeight: 2.4,
        color: "var(--side-ink)",
        transition: "color var(--dur-hover)",
      }}
    >
      {label}
    </Link>
  );
}
