// ============================================================================
// HAOYAO 通用工具单元测试（lib/utils.test.ts）
// 用例：M7-UT-004~006 —— formatPrice（分→¥ 千分位）/ formatDate（UTC→本地）。
// 依据：技术文档 §8.3（金额传输为分；时间 UTC ISO8601）。
// ============================================================================

import { describe, expect, it } from "vitest";

import { formatDate, formatPrice } from "./utils";

describe("formatPrice 金额格式化", () => {
  it("正常金额：分 → ¥ 千分位", () => {
    expect(formatPrice(128000)).toBe("¥ 1,280");
    expect(formatPrice(68800)).toBe("¥ 688");
    expect(formatPrice(520)).toBe("¥ 5.2");
  });

  it("0 与负数 → null（未定价占位）", () => {
    expect(formatPrice(0)).toBeNull();
    expect(formatPrice(-1)).toBeNull();
  });
});

describe("formatDate 日期本地化", () => {
  it("UTC ISO8601 → 本地可读日期", () => {
    // 固定 UTC 时间；本地时区（Asia/Shanghai +8）显示同日
    const result = formatDate("2026-08-26T00:00:00Z", "zh-CN");
    expect(result).toContain("2026");
    expect(result).toContain("8");
  });

  it("非法时间 → 原样返回（不抛异常）", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date");
  });
});
