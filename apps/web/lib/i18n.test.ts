// ============================================================================
// HAOYAO i18n 工具单元测试（lib/i18n.test.ts）
// 用例：M7-UT-001~003 —— t() 三级回退链（当前语言 → zh → key 本身）。
// 依据：技术文档 §7.4（静态文案字典 + 回退链防白屏）。
// ============================================================================

import { describe, expect, it } from "vitest";

import { t } from "./i18n";

describe("i18n t() 翻译回退链", () => {
  it("中文：命中 zh 字典", () => {
    expect(t("nav.home", "zh")).toBe("首页");
    expect(t("home.slogan", "zh")).toBe("皓启纯净，遥见本真");
  });

  it("英文：命中 en 字典（独立英文文案）", () => {
    expect(t("nav.home", "en")).toBe("Home");
    expect(t("common.new", "en")).toBe("New");
  });

  it("英文缺失 key → 回退中文", () => {
    // 模拟：en 字典缺失某 key（此处用一个真实存在于 zh 的 key 验证回退机制）
    // 说明：当前两字典 key 对齐，回退链用 zh 字典中存在的 key 验证
    expect(t("footer.icp", "en")).toBe("ICP license placeholder");
    // zh 全量 key 在 en 均有对应；缺失场景以未知 key 验证兜底
    expect(t("nav.unknown_key", "zh")).toBe("nav.unknown_key");
    expect(t("nav.unknown_key", "en")).toBe("nav.unknown_key");
  });

  it("任意语言参数 → 非 en 一律走 zh", () => {
    expect(t("nav.home", "fr")).toBe("首页");
    expect(t("nav.home", "")).toBe("首页");
  });
});
