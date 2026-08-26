import type { Metadata } from "next";

import { t } from "@/lib/i18n";
import { fetchPublic } from "@/lib/api/client";

// ============================================================================
// HAOYAO 品牌故事页（app/[lang]/(front)/about/story/page.tsx，SSG）
// 功能：Hero（标题）+ 品牌故事正文（后台内容管理维护）。
// 依据：PRD §3.2 品牌故事页 / 技术文档 §7.1（SSG /story）。
// ============================================================================

export const metadata: Metadata = { title: "品牌故事" };

interface StoryPageProps {
  params: Promise<{ lang: string }>;
}

export default async function StoryPage({ params }: StoryPageProps) {
  const { lang } = await params;
  const locale = lang === "en" ? "en" : "zh";

  // SSG：品牌故事单行（build 时生成）
  const story = await fetchPublic<{
    title: { zh: string; en: string };
    content: { zh: string; en: string };
    hero_image: string;
  }>("/story").catch(() => null);

  const content = story ? (locale === "en" ? story.content.en || story.content.zh : story.content.zh) : "";

  return (
    <div>
      {/* Hero 区 */}
      <div style={{ textAlign: "center", padding: "64px 24px 48px" }}>
        <div style={{ fontSize: "var(--fs-eyebrow)", letterSpacing: "0.4em", color: "var(--gold-deep)" }}>
          THE HOUSE OF HAOYAO
        </div>
        <h1 style={{ marginTop: 16, fontSize: "var(--fs-h1)", fontWeight: 400, letterSpacing: "0.2em", color: "var(--ink)" }}>
          {t("about.ourStory", locale)}
        </h1>
      </div>

      {/* 故事正文 */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 24px 96px", lineHeight: 2, fontSize: 16, color: "var(--ink-2)" }}>
        {content ? (
          <p style={{ whiteSpace: "pre-line" }}>{content}</p>
        ) : (
          <p style={{ textAlign: "center", color: "var(--ink-3)", letterSpacing: "0.1em" }}>
            {t("about.storyPreparing", locale)}
          </p>
        )}
        <div style={{ marginTop: 40, textAlign: "center", letterSpacing: "0.3em", color: "var(--gold-deep)", fontSize: 14 }}>
          {t("about.slogan", locale)}
        </div>
      </div>
    </div>
  );
}
