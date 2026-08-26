// ============================================================================
// HAOYAO 前端 ESLint 配置（eslint.config.mjs，flat config）
// 依据：《HAOYAO_官网_开发技术文档.md》§3.4 代码规范：
//   - ESLint + Prettier + TypeScript strict；禁止 any
// 说明：eslint-config-next 15.x 仍为 legacy（eslintrc）配置对象，
//   经 FlatCompat 转换为 flat config（Next 15 官方推荐做法）。
// ============================================================================

import { defineConfig, globalIgnores } from "eslint/config";
import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 计算配置目录（ESM 下无 __dirname）
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// legacy → flat 转换器（baseDirectory 指向本目录，用于解析 eslint-config-next）
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = defineConfig([
  // Next.js 官方规则集：core-web-vitals（性能/可访问性）+ TypeScript
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // 忽略构建产物与类型声明文件
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
