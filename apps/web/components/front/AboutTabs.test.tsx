// ============================================================================
// HAOYAO AboutTabs 组件测试（components/front/AboutTabs.test.tsx）
// 用例：M7-UT-007 —— 渲染 3 Tab 且当前页高亮（aria/样式）。
// 说明：mock next/navigation 的 usePathname；next/link 在 jsdom 下渲染为 <a>。
// ============================================================================

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// 固定当前路由 = 品牌故事页（验证高亮逻辑）
vi.mock("next/navigation", () => ({
  usePathname: () => "/about/story",
}));

import AboutTabs from "./AboutTabs";

describe("AboutTabs 关于页 Tab", () => {
  it("中文：渲染 3 个 Tab 链接", () => {
    render(<AboutTabs locale="zh" />);
    expect(screen.getByText("品牌故事")).toBeInTheDocument();
    expect(screen.getByText("发展历程")).toBeInTheDocument();
    expect(screen.getByText("联系我们")).toBeInTheDocument();
  });

  it("当前页（/about/story）tab 高亮", () => {
    render(<AboutTabs locale="zh" />);
    const active = screen.getByText("品牌故事");
    // 高亮：金色下边框（active 态）；jsdom 对 var() 颜色解析不完整，断言原始样式字符串
    expect(active.closest("a")?.style.borderBottom).toContain("var(--gold)");
    // 非当前 tab 为透明边框
    const inactive = screen.getByText("发展历程");
    expect(inactive.closest("a")?.style.borderBottom).toContain("transparent");
  });

  it("英文：Tab 文案为英文", () => {
    render(<AboutTabs locale="en" />);
    expect(screen.getByText("Brand Story")).toBeInTheDocument();
    expect(screen.getByText("History")).toBeInTheDocument();
    expect(screen.getByText("Contact Us")).toBeInTheDocument();
  });
});
