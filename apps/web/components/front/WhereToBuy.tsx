"use client";

// ============================================================================
// HAOYAO 购买渠道 CTA（components/front/WhereToBuy.tsx）
// 功能：纯展示品牌站（无电商）——点击提示联系渠道（PRD §4.3）。
// 说明：服务端组件不能绑定事件，故独立为 client 组件。
// ============================================================================

interface WhereToBuyProps {
  locale: "zh" | "en";
}

export default function WhereToBuy({ locale }: WhereToBuyProps) {
  const label = locale === "en" ? "Where to Buy" : "了解购买渠道";
  return (
    <button
      style={{
        marginTop: 40,
        padding: "14px 48px",
        border: "1px solid var(--ink)",
        fontSize: 14,
        letterSpacing: "0.2em",
        color: "var(--ink)",
        transition: "background var(--dur-hover) var(--ease-brand)",
      }}
      onClick={() =>
        window.alert(
          locale === "en"
            ? "Please contact us for purchase channels."
            : "欢迎通过「联系我们」了解购买渠道。",
        )
      }
    >
      {label}
    </button>
  );
}
