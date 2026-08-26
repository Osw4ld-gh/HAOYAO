import AboutTabs from "@/components/front/AboutTabs";

// ============================================================================
// HAOYAO 关于页统一布局（app/[lang]/(front)/about/layout.tsx）
// 功能：品牌故事 / 发展历程 / 联系我们 三页共用 Tab（PRD V1.2）。
// ============================================================================

interface AboutLayoutProps {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}

export default async function AboutLayout({ children, params }: AboutLayoutProps) {
  const { lang } = await params;
  const locale = lang === "en" ? "en" : "zh";

  return (
    <div style={{ maxWidth: "var(--container-max)", margin: "0 auto", padding: "48px var(--container-pad) 0" }}>
      <AboutTabs locale={locale} />
      {children}
    </div>
  );
}
