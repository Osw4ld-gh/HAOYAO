"use client";

// ============================================================================
// HAOYAO 产品图片画廊（components/front/ProductGallery.tsx）
// 功能：详情页多图 —— 主图大图 + 缩略图切换（点击切换，600ms 淡入）。
// 依据：UI 规范 §3.9 产品详情页（多图交互）。
// ============================================================================

import { useState } from "react";

interface ProductGalleryProps {
  images: { url: string; is_cover: boolean }[];
  alt: string;
}

export default function ProductGallery({ images, alt }: ProductGalleryProps) {
  const [active, setActive] = useState(0);

  // 无图兜底
  if (images.length === 0) {
    return (
      <div
        style={{
          aspectRatio: "3 / 4",
          background: "var(--bg-soft)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--ink-3)",
          fontSize: 13,
          letterSpacing: "0.2em",
        }}
      >
        HAOYAO
      </div>
    );
  }

  const current = images[Math.min(active, images.length - 1)];

  return (
    <div>
      {/* 主图 */}
      <div style={{ aspectRatio: "3 / 4", overflow: "hidden", background: "var(--bg-soft)" }}>
        {current.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.url}
            alt={alt}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          // URL 为空时显示占位（避免 src="" 触发浏览器重新下载整页）
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-3)", fontSize: 13, letterSpacing: "0.2em" }}>
            HAOYAO
          </div>
        )}
      </div>

      {/* 缩略图（多于 1 张时显示） */}
      {images.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              style={{
                width: 64,
                height: 64,
                padding: 0,
                border: i === active ? "2px solid var(--gold)" : "1px solid var(--line)",
                opacity: i === active ? 1 : 0.6,
                overflow: "hidden",
              }}
              aria-label={`查看第 ${i + 1} 张图片`}
            >
              {img.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", background: "var(--bg-soft)" }} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
