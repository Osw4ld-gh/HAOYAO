"use client";

// ============================================================================
// HAOYAO 后台：导航配置页（app/admin/navigation/page.tsx）
// 功能：树形导航管理 —— 列表（含停用项）+ 新增/编辑弹层 + 启停 + 删除。
// 依据：UI 规范 §6.3 导航配置 + 技术文档 §6.5.2：
//   - 树形展示（顶层 + 缩进子项）
//   - 删除含子项 → 后端 422 NAV_HAS_CHILDREN（提示先删子项）
//   - 保存后即时生效（导航接口 SSR 实时拉取，不依赖 ISR）
// ============================================================================

import { useCallback, useEffect, useState } from "react";

import TopBar from "@/components/admin/TopBar";
import Modal from "@/components/admin/Modal";
import { AdminApiError, navigationApi } from "@/lib/admin/client";
import type { AdminNavNode, NavPayload } from "@/lib/admin/types";

// 空表单初始值（新增）
const EMPTY_FORM: NavPayload = {
  parent_id: null,
  label: { zh: "", en: "" },
  link_type: "page",
  link_value: "",
  sort: 0,
  enabled: true,
};

const LINK_TYPE_LABEL: Record<NavPayload["link_type"], string> = {
  home: "首页",
  category: "分类",
  page: "内容页",
  news: "资讯",
  url: "外部链接",
};

export default function NavigationPage() {
  const [tree, setTree] = useState<AdminNavNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminNavNode | null>(null);
  const [form, setForm] = useState<NavPayload>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // 加载导航树
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTree(await navigationApi.list());
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 打开新增弹层
  const openCreate = (parentId: number | null = null) => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, parent_id: parentId });
    setModalOpen(true);
  };

  // 打开编辑弹层
  const openEdit = (node: AdminNavNode) => {
    setEditing(node);
    setForm({
      parent_id: node.parent_id ?? null,
      label: { ...node.label },
      link_type: node.link_type,
      link_value: node.link_value,
      sort: node.sort,
      enabled: node.enabled,
    });
    setModalOpen(true);
  };

  // 保存（新增/编辑）
  const handleSave = async () => {
    if (!form.label.zh.trim()) {
      setError("中文标签（label.zh）必填");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await navigationApi.update(editing.id, form);
      } else {
        await navigationApi.create(form);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  // 删除（含子项由后端 422 拦截并提示）
  const handleDelete = async (node: AdminNavNode) => {
    if (!window.confirm(`确认删除导航「${node.label.zh}」？`)) return;
    try {
      await navigationApi.remove(node.id);
      await load();
    } catch (err) {
      if (err instanceof AdminApiError && err.code === 42200) {
        window.alert("该导航项包含子项，请先删除子项");
      } else {
        window.alert(err instanceof AdminApiError ? err.message : "删除失败");
      }
    }
  };

  // 启停
  const handleToggle = async (node: AdminNavNode) => {
    try {
      await navigationApi.toggle(node.id, !node.enabled);
      await load();
    } catch (err) {
      window.alert(err instanceof AdminApiError ? err.message : "操作失败");
    }
  };

  // 递归渲染树节点（缩进展示层级）
  const renderNodes = (nodes: AdminNavNode[], depth: number): React.ReactNode =>
    nodes.map((node) => (
      <div key={node.id}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 16px",
            paddingLeft: 16 + depth * 28,
            borderBottom: "1px solid var(--line)",
            background: node.enabled ? "#fff" : "#faf8f4",
          }}
        >
          {/* 标签（双语） */}
          <span style={{ width: 180, fontSize: 14, color: "var(--ink)" }}>
            {node.label.zh}
            <span style={{ color: "var(--ink-3)", fontSize: 12, marginLeft: 8 }}>
              {node.label.en || "—"}
            </span>
          </span>
          {/* 链接信息 */}
          <span style={{ width: 100, fontSize: 12, color: "var(--ink-2)" }}>
            {LINK_TYPE_LABEL[node.link_type]}
          </span>
          <span style={{ flex: 1, fontSize: 12, color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {node.link_value}
          </span>
          {/* 排序 */}
          <span style={{ width: 48, fontSize: 12, color: "var(--ink-3)" }}>{node.sort}</span>
          {/* 启停开关 */}
          <button
            onClick={() => handleToggle(node)}
            style={{
              width: 36,
              height: 20,
              borderRadius: 10,
              border: "none",
              background: node.enabled ? "var(--green)" : "var(--line)",
              position: "relative",
              transition: "background 200ms",
            }}
            aria-label={node.enabled ? "停用" : "启用"}
          >
            <span
              style={{
                position: "absolute",
                top: 2,
                left: node.enabled ? 18 : 2,
                width: 16,
                height: 16,
                borderRadius: 8,
                background: "#fff",
                transition: "left 200ms",
              }}
            />
          </button>
          {/* 操作 */}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => openCreate(node.id)} style={{ fontSize: 12, color: "var(--gold-deep)" }}>
              + 子项
            </button>
            <button onClick={() => openEdit(node)} style={{ fontSize: 12, color: "var(--ink-2)" }}>
              编辑
            </button>
            <button onClick={() => handleDelete(node)} style={{ fontSize: 12, color: "var(--red)" }}>
              删除
            </button>
          </div>
        </div>
        {node.children.length > 0 && renderNodes(node.children, depth + 1)}
      </div>
    ));

  return (
    <>
      <TopBar title="导航配置" />
      <div style={{ padding: "28px 32px 60px" }}>
        {/* 页头 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: "var(--ink-2)" }}>
            主导航共 {tree.length} 项（含停用）
          </div>
          <button
            onClick={() => openCreate(null)}
            style={{
              padding: "8px 16px",
              background: "var(--hero-1)",
              color: "#fff",
              fontSize: 13,
              letterSpacing: "0.1em",
              borderRadius: "var(--radius-admin)",
            }}
          >
            + 新增导航
          </button>
        </div>

        {error && (
          <div style={{ padding: "10px 12px", marginBottom: 16, fontSize: 13, color: "var(--red)", background: "rgba(166,61,61,0.08)", borderRadius: 4 }}>
            {error}
          </div>
        )}

        {/* 表头 */}
        <div
          style={{
            display: "flex",
            gap: 12,
            padding: "8px 16px",
            background: "var(--bg-soft)",
            fontSize: 11,
            letterSpacing: "0.2em",
            color: "var(--ink-3)",
          }}
        >
          <span style={{ width: 180 }}>标签（中 / EN）</span>
          <span style={{ width: 100 }}>类型</span>
          <span style={{ flex: 1 }}>目标</span>
          <span style={{ width: 48 }}>排序</span>
          <span style={{ width: 36 }}>启停</span>
          <span style={{ width: 140 }}>操作</span>
        </div>

        {/* 树形列表 */}
        <div style={{ border: "1px solid var(--line)", borderTop: "none" }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--ink-3)" }}>加载中…</div>
          ) : (
            renderNodes(tree, 0)
          )}
        </div>

        {/* 新增/编辑弹层 */}
        <Modal
          title={editing ? `编辑导航：${editing.label.zh}` : "新增导航"}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
        >
          {/* 父级选择 */}
          <label style={{ display: "block", fontSize: 13, color: "var(--ink-2)", marginBottom: 6 }}>
            父级（留空为顶层）
          </label>
          <select
            value={form.parent_id ?? ""}
            onChange={(e) => setForm({ ...form, parent_id: e.target.value ? Number(e.target.value) : null })}
            style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 2, fontSize: 14, marginBottom: 16 }}
          >
            <option value="">顶层（无父级）</option>
            {tree.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label.zh}
              </option>
            ))}
          </select>

          {/* 双语标签 */}
          <label style={{ display: "block", fontSize: 13, color: "var(--ink-2)", marginBottom: 6 }}>
            中文标签 *
          </label>
          <input
            value={form.label.zh}
            onChange={(e) => setForm({ ...form, label: { ...form.label, zh: e.target.value } })}
            placeholder="如：香水"
            style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 2, fontSize: 14, marginBottom: 12 }}
          />
          <label style={{ display: "block", fontSize: 13, color: "var(--ink-2)", marginBottom: 6 }}>
            英文标签
          </label>
          <input
            value={form.label.en}
            onChange={(e) => setForm({ ...form, label: { ...form.label, en: e.target.value } })}
            placeholder="如：Fragrance"
            style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 2, fontSize: 14, marginBottom: 16 }}
          />

          {/* 链接类型与目标 */}
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: 13, color: "var(--ink-2)", marginBottom: 6 }}>链接类型</label>
              <select
                value={form.link_type}
                onChange={(e) => setForm({ ...form, link_type: e.target.value as NavPayload["link_type"] })}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 2, fontSize: 14 }}
              >
                {Object.entries(LINK_TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 2 }}>
              <label style={{ display: "block", fontSize: 13, color: "var(--ink-2)", marginBottom: 6 }}>链接目标</label>
              <input
                value={form.link_value}
                onChange={(e) => setForm({ ...form, link_value: e.target.value })}
                placeholder="分类 slug / 页面 key / URL"
                style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 2, fontSize: 14 }}
              />
            </div>
          </div>

          {/* 排序 + 启用 */}
          <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
            <div style={{ width: 120 }}>
              <label style={{ display: "block", fontSize: 13, color: "var(--ink-2)", marginBottom: 6 }}>排序</label>
              <input
                type="number"
                value={form.sort}
                onChange={(e) => setForm({ ...form, sort: Number(e.target.value) })}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 2, fontSize: 14 }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-2)" }}>
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                />
                启用
              </label>
            </div>
          </div>

          {/* 操作区 */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <button
              onClick={() => setModalOpen(false)}
              style={{ padding: "8px 20px", border: "1px solid var(--line)", borderRadius: 2, fontSize: 13, color: "var(--ink-2)" }}
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ padding: "8px 20px", background: "var(--hero-1)", color: "#fff", borderRadius: 2, fontSize: 13, opacity: saving ? 0.6 : 1 }}
            >
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        </Modal>
      </div>
    </>
  );
}
