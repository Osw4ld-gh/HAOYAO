// ============================================================================
// HAOYAO 前端通用工具（lib/utils.ts）
// 功能：金额格式化、日期本地化等通用函数。
// 依据：《HAOYAO_官网_开发技术文档.md》§8.3 联调约定：
//   - 金额传输为分（int），前端 formatPrice() 输出 ¥ 1,280（千分位）
//   - 时间后端输出 UTC ISO8601（带 Z），前端 Intl.DateTimeFormat 按本地时区展示
// ============================================================================

/**
 * 金额格式化：分 → "¥ 1,280"（千分位）。
 *
 * 说明：未定价（0 分）时返回 null，由调用方决定是否渲染
 * （受 site_setting.switches.show_price 控制，数据层不感知）。
 */
export function formatPrice(cents: number): string | null {
  if (cents < 0) return null;
  if (cents === 0) return null; // 0 = 未定价占位（数据库文档 §2.4）
  const yuan = cents / 100;
  return `¥ ${yuan.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}

/**
 * 日期本地化：UTC ISO8601 → 本地时区可读日期（如 2026年8月26日）。
 *
 * 说明：后端一律输出 UTC（带 Z），前端按用户本地时区展示（技术文档 §8.3）。
 */
export function formatDate(iso: string, locale: string = "zh-CN"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso; // 非法时间原样返回
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}
