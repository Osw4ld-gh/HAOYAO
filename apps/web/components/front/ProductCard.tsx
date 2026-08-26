"use client";

// ============================================================================
// HAOYAO 前台产品卡片（components/front/ProductCard.tsx）
// 功能：产品网格卡片 —— 图片（hover 缩放 600ms）+ 名称双语 + 价格（分→元）
//       + 新品标签（红色点缀）。
// 依据：UI 规范 §3.5 产品卡：卡片悬停位移 350ms、图片放大 600ms、直角；
//       show_price 开关（site_config）M4 接入，M3 默认展示价格。
// ============================================================================

import Link from "next/link";

import type { ProductCard as ProductCardType } from "@/lib/api/types";

interface ProductCardProps {
  product: ProductCardType;
  locale: "zh" | "en";
  /** 是否显示价格（M4 接入 site_config.switches.show_price） */
  showPrice?: boolean;
}

/** 分（后端存储）→ 元（展示） */
function fenToYuan(fen: number): string {
  return (fen / 100).toFixed(2);
}

export default function ProductCard({ product, locale, showPrice = true }: ProductCardProps) {
  const prefix = locale === "en" ? "/en" : "";
  // 详情路由：/{top_slug}/p/{id}（技术文档 §7.1；缺省回退 skincare）
  const topSlug = product.top_slug ?? "skincare";
  const href = `${prefix}/${topSlug}/p/${product.id}`;
  const name = locale === "en" ? product.name.en || product.name.zh : product.name.zh;

  return (
    <Link
      href={href}
      className="product-card"
      style={{
        display: "block",
        background: "var(--surface)",
        // 卡片悬停位移（UI 规范 §2.5：350ms）
        transition: "transform var(--dur-card) var(--ease-brand)",
      }}
    >
      {/* 图片区（背景底 + hover 放大） */}
      <div
        style={{
          position: "relative",
          aspectRatio: "3 / 4",
          overflow: "hidden",
          background: "var(--bg-soft)",
        }}
      >
        {product.cover_image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.cover_image}
            alt={name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              // hover 放大（UI 规范 §2.5：600ms）
              transition: "transform var(--dur-zoom) var(--ease-brand)",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--ink-3)",
              fontSize: 12,
              letterSpacing: "0.2em",
            }}
          >
            HAOYAO
          </div>
        )}
        {/* 新品标签（红色点缀，UI 规范 §2.1） */}
        {product.is_new && (
          <span
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              padding: "3px 10px",
              fontSize: 11,
              letterSpacing: "0.2em",
              color: "#fff",
              background: "var(--red)",
            }}
          >
            {locale === "en" ? "NEW" : "新品"}
          </span>
        )}
      </div>

      {/* 文字区 */}
      <div style={{ padding: "16px 4px 20px", textAlign: "center" }}>
        <div
          style={{
            fontSize: 15,
            letterSpacing: "0.08em",
            color: "var(--ink)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </div>
        {showPrice && (
          <div style={{ marginTop: 8, fontSize: 13, color: "var(--ink-2)" }}>
            ¥{fenToYuan(product.price)}
          </div>
        )}
      </div>
    </Link>
  );
}
