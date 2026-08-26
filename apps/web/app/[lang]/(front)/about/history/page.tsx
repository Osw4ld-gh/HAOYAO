import type { Metadata } from "next";

import { t } from "@/lib/i18n";
import { fetchPublic } from "@/lib/api/client";

// ============================================================================
// HAOYAO 发展历程页（app/[lang]/(front)/about/history/page.tsx，SSG）
// 功能：品牌发展时间轴 —— 年份倒序（后台内容管理维护）。
// 依据：PRD §3.2 发展历程页 / 技术文档 §7.1（SSG /timeline）。
// ============================================================================

export const metadata: Metadata = { title: "发展历程" };

interface HistoryPageProps {
  params: Promise<{ lang: string }>;
}

export default async function HistoryPage({ params }: HistoryPageProps) {
  const { lang } = await params;
  const locale = lang === "en" ? "en" : "zh";

  const timeline = await fetchPublic<
    { id: number; year: number; title: { zh: string; en: string }; desc: { zh: string; en: string }; image_url: string }[]
  >("/timeline").catch(() => []);

  return (
    <div style={{ paddingBottom: 96 }}>
      <div style={{ textAlign: "center", padding: "24px 24px 56px" }}>
        <h1 style={{ fontSize: "var(--fs-h1)", fontWeight: 400, letterSpacing: "0.2em", color: "var(--ink)" }}>
          {t("about.ourHistory", locale)}
        </h1>
      </div>

      {timeline.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--ink-3)", padding: "40px 0", fontSize: 14, letterSpacing: "0.1em" }}>
          {t("about.timelinePreparing", locale)}
        </div>
      ) : (
        // 纵向时间轴：年份倒序（接口已排序）
        <div style={{ maxWidth: 720, margin: "0 auto", position: "relative" }}>
          {timeline.map((item, idx) => (
            <div key={item.id} style={{ display: "flex", gap: 32, position: "relative", paddingBottom: 48 }}>
              {/* 年份 */}
              <div style={{ width: 88, textAlign: "right", fontSize: "var(--fs-h3)", fontWeight: 400, letterSpacing: "0.1em", color: "var(--gold-deep)", flexShrink: 0 }}>
                {item.year}
              </div>
              {/* 节点圆点 + 竖线 */}
              <div style={{ position: "relative", width: 16, flexShrink: 0 }}>
                <span style={{ position: "absolute", left: 4, top: 8, width: 8, height: 8, borderRadius: 4, background: "var(--gold)" }} />
                {idx < timeline.length - 1 && (
                  <span style={{ position: "absolute", left: 7, top: 16, width: 2, height: "calc(100% + 32px)", background: "var(--line)" }} />
                )}
              </div>
              {/* 内容 */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, letterSpacing: "0.06em", color: "var(--ink)" }}>
                  {locale === "en" ? item.title.en || item.title.zh : item.title.zh}
                </div>
                {item.desc.zh || item.desc.en ? (
                  <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.8, color: "var(--ink-2)" }}>
                    {locale === "en" ? item.desc.en || item.desc.zh : item.desc.zh}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
