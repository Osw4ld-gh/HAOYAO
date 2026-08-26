"use client";

// ============================================================================
// HAOYAO 后台：仪表盘页（app/admin/dashboard/page.tsx）
// 功能：6 统计卡片（产品/分类/资讯/轮播/媒体/待翻译）+ 最近操作审计。
// 依据：PRD §5.2 仪表盘 / 技术文档 §6.5.5（/admin/dashboard/stats）。
// ============================================================================

import { useEffect, useState } from "react";

import TopBar from "@/components/admin/TopBar";
import { AdminApiError, dashboardApi, type DashboardStats } from "@/lib/admin/client";

// 审计动作中文标签
const ACTION_LABEL: Record<string, string> = {
  login: "登录",
  logout: "登出",
  create: "新增",
  update: "修改",
  delete: "删除",
  toggle: "启停",
  publish: "发布",
  batch_status: "批量状态",
};

const TARGET_LABEL: Record<string, string> = {
  product: "产品",
  article: "资讯",
  navigation: "导航",
  timeline: "时间轴",
  story: "品牌故事",
  banner: "轮播",
  media: "媒体",
  site_config: "网站配置",
  admin_password: "账号密码",
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dashboardApi
      .stats()
      .then(setStats)
      .catch((err) => setError(err instanceof AdminApiError ? err.message : "加载失败"));
  }, []);

  return (
    <>
      <TopBar title="仪表盘" />
      <div style={{ padding: "28px 32px 60px" }}>
        {error && (
          <div style={{ padding: "10px 12px", marginBottom: 16, fontSize: 13, color: "var(--red)", background: "rgba(166,61,61,0.08)", borderRadius: 4 }}>
            {error}
          </div>
        )}

        {!stats ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--ink-3)" }}>加载中…</div>
        ) : (
          <>
            {/* 6 统计卡片 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
              <StatCard label="产品总数" value={stats.products} hint={`分类 ${stats.categories.top} 顶层 / ${stats.categories.sub} 二级`} />
              <StatCard label="资讯" value={stats.articles.total} hint={`已发布 ${stats.articles.published}`} />
              <StatCard label="轮播（启用）" value={stats.banners} hint="首页 Banner" />
              <StatCard label="媒体资源" value={stats.media.total} hint={`图片 ${stats.media.images} / 视频 ${stats.media.videos}`} />
              <StatCard label="待翻译 · 产品" value={stats.translation.products_incomplete} danger={stats.translation.products_incomplete > 0} />
              <StatCard label="待翻译 · 资讯" value={stats.translation.articles_incomplete} danger={stats.translation.articles_incomplete > 0} />
            </div>

            {/* 最近操作审计 */}
            <div style={{ marginBottom: 12, fontSize: 15, letterSpacing: "0.08em", color: "var(--ink)" }}>最近操作</div>
            <div style={{ border: "1px solid var(--line)" }}>
              {stats.recent_audits.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--ink-3)" }}>暂无操作记录</div>
              ) : (
                stats.recent_audits.map((audit) => (
                  <div key={audit.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 16px", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
                    <span style={{ width: 48, color: "var(--gold-deep)", fontWeight: 500 }}>
                      {ACTION_LABEL[audit.action] ?? audit.action}
                    </span>
                    <span style={{ width: 90, color: "var(--ink-2)" }}>{TARGET_LABEL[audit.target_type] ?? audit.target_type}</span>
                    <span style={{ flex: 1, color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {audit.operator}
                      {audit.target_id ? ` · #${audit.target_id}` : ""}
                      {audit.detail && Object.keys(audit.detail).length > 0 ? ` · ${JSON.stringify(audit.detail).slice(0, 80)}` : ""}
                    </span>
                    <span style={{ color: "var(--ink-3)", fontSize: 12 }}>{audit.created_at}</span>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function StatCard({ label, value, hint, danger = false }: { label: string; value: number; hint?: string; danger?: boolean }) {
  return (
    <div style={{ padding: "20px 24px", background: "#fff", border: "1px solid var(--line)", boxShadow: "var(--shadow)" }}>
      <div style={{ fontSize: 13, letterSpacing: "0.08em", color: "var(--ink-2)" }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 32, fontWeight: 600, color: danger ? "var(--red)" : "var(--ink)" }}>{value}</div>
      {hint && <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink-3)" }}>{hint}</div>}
    </div>
  );
}
