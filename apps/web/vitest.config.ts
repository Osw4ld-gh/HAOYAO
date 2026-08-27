// ============================================================================
// HAOYAO 前端 Vitest 配置（apps/web/vitest.config.ts）
// 功能：单元测试运行配置 —— React 插件 + jsdom 环境 + @ alias。
// 依据：M7 测试（方案 §4-M7：前端 Vitest 单元测试配置与用例）。
// ============================================================================

import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    // jsdom：组件渲染需要 DOM 环境
    environment: "jsdom",
    // 测试文件匹配：*.test.ts / *.test.tsx（放在被测模块旁）
    include: ["**/*.test.{ts,tsx}"],
    // 全局注入（describe/it/expect 无需 import）
    globals: true,
    // 全局 setup：注入 @testing-library/jest-dom 匹配器
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    // 与 tsconfig paths 对齐（@/* → 项目根）
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
