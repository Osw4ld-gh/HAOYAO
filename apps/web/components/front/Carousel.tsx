"use client";

// ============================================================================
// HAOYAO 前台轮播（components/front/Carousel.tsx）
// 功能：Banner 轮播 —— 自动播放（7s）+ 手动切换 + 01/03 数字计数器。
// 依据：UI 规范 §3.6 轮播（PRD V1.2：banner 数字计数器；hover 暂停）。
// ============================================================================

import { useCallback, useEffect, useState } from "react";

import type { Banner } from "@/lib/api/types";

interface CarouselProps {
  banners: Banner[];
  locale: "zh" | "en";
}

export default function Carousel({ banners, locale }: CarouselProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const count = banners.length;

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % count);
  }, [count]);

  // 自动播放（7s/张；hover 或单张时暂停）
  useEffect(() => {
    if (count <= 1 || paused) return;
    const timer = setInterval(next, 7000);
    return () => clearInterval(timer);
  }, [count, paused, next]);

  if (count === 0) return null;

  return (
    <div
      style={{ position: "relative", overflow: "hidden", aspectRatio: "21 / 9", background: "var(--hero-1)" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* 幻灯片（淡入切换） */}
      {banners.map((banner, i) => (
        <div
          key={banner.id}
          style={{
            position: "absolute",
            inset: 0,
            opacity: i === index ? 1 : 0,
            transition: "opacity var(--dur-carousel) var(--ease-brand)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={banner.image_url}
            alt={locale === "en" ? banner.title.en || banner.title.zh : banner.title.zh}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          {/* 标题浮层 */}
          <div
            style={{
              position: "absolute",
              left: "var(--container-pad)",
              bottom: 48,
              color: "#fff",
              textShadow: "0 2px 12px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ fontSize: "var(--fs-h2)", letterSpacing: "0.1em", fontWeight: 400 }}>
              {locale === "en" ? banner.title.en || banner.title.zh : banner.title.zh}
            </div>
          </div>
        </div>
      ))}

      {/* 数字计数器 01/03（PRD V1.2） */}
      <div
        style={{
          position: "absolute",
          right: "var(--container-pad)",
          bottom: 40,
          fontSize: 13,
          letterSpacing: "0.3em",
          color: "#fff",
        }}
      >
        {String(index + 1).padStart(2, "0")}
        <span style={{ opacity: 0.5 }}> / {String(count).padStart(2, "0")}</span>
      </div>

      {/* 左右箭头 */}
      <button
        onClick={() => setIndex((index - 1 + count) % count)}
        style={{ position: "absolute", left: 20, top: "50%", transform: "translateY(-50%)", color: "#fff", fontSize: 28, opacity: 0.7 }}
        aria-label="上一张"
      >
        ‹
      </button>
      <button
        onClick={() => setIndex((index + 1) % count)}
        style={{ position: "absolute", right: 20, top: "50%", transform: "translateY(-50%)", color: "#fff", fontSize: 28, opacity: 0.7 }}
        aria-label="下一张"
      >
        ›
      </button>
    </div>
  );
}
