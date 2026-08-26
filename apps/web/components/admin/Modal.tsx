"use client";

// ============================================================================
// HAOYAO 后台通用弹层（components/admin/Modal.tsx）
// 功能：受控弹层 —— 遮罩 + 居中面板（UI 规范 §4.6）。
// 说明：z-index 使用 tokens --z-modal；关闭动画由 CSS 过渡（--dur-modal）。
// ============================================================================

import { useEffect } from "react";

interface ModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}

export default function Modal({ title, open, onClose, children, width = 560 }: ModalProps) {
  // Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    // 遮罩
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(25,25,24,0.45)",
        zIndex: "var(--z-mask)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      {/* 面板：点击内部不关闭 */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width,
          maxWidth: "90vw",
          maxHeight: "80vh",
          overflowY: "auto",
          background: "#fff",
          boxShadow: "var(--shadow)",
          borderRadius: "var(--radius-admin)",
          zIndex: "var(--z-modal)",
        }}
      >
        {/* 标题栏 */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 24px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <h2 style={{ fontSize: "var(--fs-admin-modal)", fontWeight: 500, letterSpacing: "0.08em" }}>
            {title}
          </h2>
          <button onClick={onClose} style={{ fontSize: 18, color: "var(--ink-3)" }} aria-label="关闭">
            ×
          </button>
        </div>
        {/* 内容区 */}
        <div style={{ padding: "24px" }}>{children}</div>
      </div>
    </div>
  );
}
