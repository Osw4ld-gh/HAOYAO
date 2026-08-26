import type { NextConfig } from "next";

// ============================================================================
// HAOYAO 前端 Next.js 配置（next.config.ts）
// 功能：Next.js 15 全局配置。
// 依据：《HAOYAO_官网_开发技术文档.md》§7 前端工程规范。
// 环境适配说明（2026-08-26）：
//   本地 WorkBuddy 桌面环境注入了"删除保护"shim，next build 清理 webpack
//   文件缓存（硬链接指向 node_modules）时会触发批量删除拦截（safe-delete
//   SAFE_DELETE_BULK_REJECTED）。因此开发环境禁用 webpack filesystem 缓存：
//   - 本地：构建稍慢但稳定（无缓存清理即无拦截）
//   - CI/生产：该配置同样安全（缓存非必需，仅影响增量构建速度）
//   M7 优化构建时长时可在正常环境中恢复缓存。
// ============================================================================

const nextConfig: NextConfig = {
  /* 页面级配置（M3 起逐步补充） */

  // 禁用 webpack filesystem 缓存（规避删除保护冲突，见文件头说明）
  webpack: (config, { dev }) => {
    if (!dev) {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
