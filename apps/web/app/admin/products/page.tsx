"use client";

// ============================================================================
// HAOYAO 后台：产品管理页（app/admin/products/page.tsx）
// 功能：产品列表（三 Tab：全部/已上架/已下架）+ 关键词搜索 + 分页
//       + 批量上/下架 + 新增/编辑弹层（双语 + 图片 + 色号）。
// 依据：UI 规范 §6.4 产品管理 + 技术文档 §6.5.1：
//   - 列表含 translation_complete（待翻译标记）
//   - 弹层校验：name.zh 必填、images 至少 1 张且仅 1 张主图
//   - M6 前图片以 URL 直填（对象存储接入后替换上传组件）
// ============================================================================

import { useCallback, useEffect, useState } from "react";

import TopBar from "@/components/admin/TopBar";
import Modal from "@/components/admin/Modal";
import { AdminApiError, categoryApi, productApi } from "@/lib/admin/client";
import type {
  AdminProduct,
  AdminProductDetail,
  ProductPayload,
  SubCategory,
  TopCategory,
} from "@/lib/admin/types";

// 空表单初始值（新增产品）
const EMPTY_FORM: ProductPayload = {
  sub_id: 0,
  name: { zh: "", en: "" },
  ref_code: "",
  price: 0,
  desc: { zh: "", en: "" },
  ingredients: { zh: "", en: "" },
  usage: { zh: "", en: "" },
  variants: [],
  is_new: false,
  status: "off",
  sort: 0,
  images: [{ url: "", is_cover: true }],
};

type TabKey = "all" | "on" | "off";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "on", label: "已上架" },
  { key: "off", label: "已下架" },
];

/** 分（后端存储）→ 元（展示） */
function fenToYuan(fen: number): string {
  return (fen / 100).toFixed(2);
}

export default function ProductsPage() {
  // 列表状态
  const [tab, setTab] = useState<TabKey>("all");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pageData, setPageData] = useState<{ total: number; items: AdminProduct[] }>({
    total: 0,
    items: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // 弹层状态
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminProductDetail | null>(null);
  const [form, setForm] = useState<ProductPayload>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // 分类数据（产品表单下拉）
  const [tops, setTops] = useState<TopCategory[]>([]);
  const [subs, setSubs] = useState<SubCategory[]>([]);

  const PAGE_SIZE = 20;

  // 加载产品列表
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await productApi.list({
        page,
        page_size: PAGE_SIZE,
        status: tab === "all" ? undefined : tab,
        keyword: keyword.trim() || undefined,
      });
      setPageData({ total: data.total, items: data.items });
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [page, tab, keyword]);

  useEffect(() => {
    load();
  }, [load]);

  // 加载分类树（弹层下拉用）
  const loadCategories = useCallback(async () => {
    try {
      const data = await categoryApi.listTop();
      setTops(data);
    } catch {
      // 分类加载失败不阻塞产品列表
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Tab / 搜索变化时回到第 1 页
  const changeTab = (key: TabKey) => {
    setTab(key);
    setPage(1);
    setSelected(new Set());
  };

  // 勾选管理
  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 批量上/下架
  const handleBatch = async (status: "on" | "off") => {
    if (selected.size === 0) return;
    if (!window.confirm(`确认批量${status === "on" ? "上架" : "下架"}选中的 ${selected.size} 个产品？`)) return;
    try {
      await productApi.batchStatus([...selected], status);
      setSelected(new Set());
      await load();
    } catch (err) {
      window.alert(err instanceof AdminApiError ? err.message : "批量操作失败");
    }
  };

  // 打开新增弹层（默认选中当前 Tab 对应状态）
  const openCreate = () => {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      status: tab === "off" ? "off" : "on",
      sub_id: subs.length > 0 ? subs[0].id : 0,
    });
    setModalOpen(true);
  };

  // 打开编辑弹层（拉详情填充）
  const openEdit = async (row: AdminProduct) => {
    try {
      const detail = await productApi.get(row.id);
      setEditing(detail);
      setForm({
        sub_id: detail.sub_id,
        name: detail.name,
        ref_code: detail.ref_code,
        price: detail.price,
        desc: detail.desc,
        ingredients: detail.ingredients,
        usage: detail.usage,
        variants: detail.variants,
        is_new: detail.is_new,
        status: detail.status,
        sort: detail.sort,
        images: detail.images.map((i) => ({ url: i.url, is_cover: i.is_cover })),
      });
      // 级联二级分类下拉
      const top = tops.find((t) => t.id === detail.top_id);
      setSubs(top ? top.sub_categories : []);
      setModalOpen(true);
    } catch (err) {
      window.alert(err instanceof AdminApiError ? err.message : "加载产品失败");
    }
  };

  // 二级分类下拉联动
  const handleTopChange = (topId: number) => {
    const top = tops.find((t) => t.id === topId);
    setSubs(top ? top.sub_categories : []);
    setForm({ ...form, sub_id: top?.sub_categories[0]?.id ?? 0 });
  };

  // 保存（新增/编辑）
  const handleSave = async () => {
    // 前端校验（后端同样强制）
    if (!form.name.zh.trim()) {
      setError("产品中文名称（name.zh）必填");
      return;
    }
    if (form.images.length === 0) {
      setError("请至少添加 1 张图片");
      return;
    }
    if (form.images.filter((i) => i.is_cover).length !== 1) {
      setError("图片中必须且只能有 1 张主图（封面）");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await productApi.update(editing.id, form);
      } else {
        await productApi.create(form);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  // 删除产品
  const handleDelete = async (row: AdminProduct) => {
    if (!window.confirm(`确认删除产品「${row.name.zh}」？`)) return;
    try {
      await productApi.remove(row.id);
      await load();
    } catch (err) {
      window.alert(err instanceof AdminApiError ? err.message : "删除失败");
    }
  };

  // 价格输入：元 → 分（存储）
  const handlePrice = (yuan: string) => {
    const fen = Math.round(Number(yuan || 0) * 100);
    setForm({ ...form, price: Number.isFinite(fen) ? fen : 0 });
  };

  // 图片行更新
  const updateImage = (index: number, patch: Partial<{ url: string; is_cover: boolean }>) => {
    setForm({
      ...form,
      images: form.images.map((img, i) => (i === index ? { ...img, ...patch } : img)),
    });
  };

  const totalPages = Math.max(1, Math.ceil(pageData.total / PAGE_SIZE));

  return (
    <>
      <TopBar title="产品管理" />
      <div style={{ padding: "28px 32px 60px" }}>
        {/* 页头：Tabs + 搜索 + 操作 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 4 }}>
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => changeTab(t.key)}
                style={{
                  padding: "8px 18px",
                  fontSize: 13,
                  borderRadius: 4,
                  letterSpacing: "0.08em",
                  background: tab === t.key ? "var(--hero-1)" : "transparent",
                  color: tab === t.key ? "#fff" : "var(--ink-2)",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          {/* 操作区 */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setPage(1);
              }}
              placeholder="搜索名称 / 编号"
              style={{ padding: "7px 12px", border: "1px solid var(--line)", borderRadius: 2, fontSize: 13, width: 180 }}
            />
            {selected.size > 0 && (
              <>
                <button onClick={() => handleBatch("on")} style={{ padding: "7px 14px", border: "1px solid var(--green)", color: "var(--green)", borderRadius: 2, fontSize: 13 }}>
                  批量上架
                </button>
                <button onClick={() => handleBatch("off")} style={{ padding: "7px 14px", border: "1px solid var(--red)", color: "var(--red)", borderRadius: 2, fontSize: 13 }}>
                  批量下架
                </button>
              </>
            )}
            <button onClick={openCreate} style={{ padding: "8px 16px", background: "var(--hero-1)", color: "#fff", fontSize: 13, letterSpacing: "0.1em", borderRadius: 2 }}>
              + 新增产品
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding: "10px 12px", marginBottom: 16, fontSize: 13, color: "var(--red)", background: "rgba(166,61,61,0.08)", borderRadius: 4 }}>
            {error}
          </div>
        )}

        {/* 表格 */}
        <div style={{ border: "1px solid var(--line)", overflowX: "auto" }}>
          {/* 表头 */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 16px", background: "var(--bg-soft)", fontSize: 11, letterSpacing: "0.2em", color: "var(--ink-3)" }}>
            <span style={{ width: 32 }}>全选</span>
            <span style={{ width: 56 }}>封面</span>
            <span style={{ flex: 2 }}>名称</span>
            <span style={{ width: 110 }}>编号</span>
            <span style={{ width: 80 }}>价格(元)</span>
            <span style={{ width: 60 }}>新品</span>
            <span style={{ width: 64 }}>状态</span>
            <span style={{ width: 50 }}>排序</span>
            <span style={{ width: 120 }}>操作</span>
          </div>
          {loading ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--ink-3)" }}>加载中…</div>
          ) : pageData.items.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--ink-3)" }}>暂无产品</div>
          ) : (
            pageData.items.map((row) => (
              <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderTop: "1px solid var(--line)" }}>
                {/* 勾选 */}
                <span style={{ width: 32 }}>
                  <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleSelect(row.id)} />
                </span>
                {/* 封面 */}
                <span style={{ width: 56 }}>
                  {row.cover_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.cover_image} alt={row.name.zh} style={{ width: 44, height: 44, objectFit: "cover", background: "var(--bg-soft)" }} />
                  ) : (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 44,
                        height: 44,
                        background: "var(--bg-soft)",
                        fontSize: 10,
                        color: "var(--ink-3)",
                      }}
                    >
                      无图
                    </span>
                  )}
                </span>
                {/* 名称 + 待翻译标记 */}
                <span style={{ flex: 2, fontSize: 14, color: "var(--ink)" }}>
                  {row.name.zh}
                  <span style={{ color: "var(--ink-3)", fontSize: 12, marginLeft: 8 }}>{row.name.en || "—"}</span>
                  {!row.translation_complete && (
                    <span style={{ marginLeft: 8, padding: "1px 6px", fontSize: 10, color: "#fff", background: "var(--red)", borderRadius: 2 }}>
                      待翻译
                    </span>
                  )}
                </span>
                <span style={{ width: 110, fontSize: 12, color: "var(--ink-2)" }}>{row.ref_code}</span>
                <span style={{ width: 80, fontSize: 13 }}>{fenToYuan(row.price)}</span>
                <span style={{ width: 60, fontSize: 12, color: row.is_new ? "var(--red)" : "var(--ink-3)" }}>{row.is_new ? "新品" : "—"}</span>
                <span style={{ width: 64, fontSize: 12 }}>
                  <span style={{ padding: "2px 8px", borderRadius: 2, color: row.status === "on" ? "var(--green)" : "var(--ink-3)", background: row.status === "on" ? "rgba(95,122,91,0.12)" : "var(--bg-soft)" }}>
                    {row.status === "on" ? "已上架" : "已下架"}
                  </span>
                </span>
                <span style={{ width: 50, fontSize: 12, color: "var(--ink-3)" }}>{row.sort}</span>
                <span style={{ width: 120, display: "flex", gap: 8 }}>
                  <button onClick={() => openEdit(row)} style={{ fontSize: 12, color: "var(--ink-2)" }}>编辑</button>
                  <button onClick={() => handleDelete(row)} style={{ fontSize: 12, color: "var(--red)" }}>删除</button>
                </span>
              </div>
            ))
          )}
        </div>

        {/* 分页 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, fontSize: 13, color: "var(--ink-2)" }}>
          <span>共 {pageData.total} 条</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={{ padding: "6px 12px", border: "1px solid var(--line)", borderRadius: 2, fontSize: 12, opacity: page <= 1 ? 0.4 : 1 }}>
              上一页
            </button>
            <span style={{ padding: "6px 8px" }}>
              {page} / {totalPages}
            </span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={{ padding: "6px 12px", border: "1px solid var(--line)", borderRadius: 2, fontSize: 12, opacity: page >= totalPages ? 0.4 : 1 }}>
              下一页
            </button>
          </div>
        </div>

        {/* ==================== 新增/编辑弹层 ==================== */}
        <Modal
          title={editing ? `编辑产品：${editing.name.zh}` : "新增产品"}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          width={760}
        >
          {/* 基础信息两列 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 8 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, color: "var(--ink-2)", marginBottom: 6 }}>中文名称 *</label>
              <input value={form.name.zh} onChange={(e) => setForm({ ...form, name: { ...form.name, zh: e.target.value } })} placeholder="焕颜精华" style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 2, fontSize: 14 }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, color: "var(--ink-2)", marginBottom: 6 }}>英文名称</label>
              <input value={form.name.en} onChange={(e) => setForm({ ...form, name: { ...form.name, en: e.target.value } })} placeholder="Radiance Serum" style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 2, fontSize: 14 }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, color: "var(--ink-2)", marginBottom: 6 }}>参考编号 *</label>
              <input value={form.ref_code} onChange={(e) => setForm({ ...form, ref_code: e.target.value })} placeholder="HY-SK-S001" style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 2, fontSize: 14 }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, color: "var(--ink-2)", marginBottom: 6 }}>价格（元）</label>
              <input type="number" min={0} value={fenToYuan(form.price)} onChange={(e) => handlePrice(e.target.value)} placeholder="1280.00" style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 2, fontSize: 14 }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, color: "var(--ink-2)", marginBottom: 6 }}>顶层分类</label>
              <select value={form.sub_id ? tops.find((t) => t.sub_categories.some((s) => s.id === form.sub_id))?.id ?? "" : ""} onChange={(e) => handleTopChange(Number(e.target.value))} style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 2, fontSize: 14 }}>
                <option value="">请选择</option>
                {tops.map((t) => (
                  <option key={t.id} value={t.id}>{t.slug}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, color: "var(--ink-2)", marginBottom: 6 }}>二级分类 *</label>
              <select value={form.sub_id} onChange={(e) => setForm({ ...form, sub_id: Number(e.target.value) })} style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 2, fontSize: 14 }}>
                <option value={0}>请选择</option>
                {subs.map((s) => (
                  <option key={s.id} value={s.id}>{s.name.zh}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, color: "var(--ink-2)", marginBottom: 6 }}>状态</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as "on" | "off" })} style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 2, fontSize: 14 }}>
                <option value="on">已上架</option>
                <option value="off">已下架</option>
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 16, paddingBottom: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-2)" }}>
                <input type="checkbox" checked={form.is_new} onChange={(e) => setForm({ ...form, is_new: e.target.checked })} />
                新品标记
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-2)" }}>
                排序
                <input type="number" value={form.sort} onChange={(e) => setForm({ ...form, sort: Number(e.target.value) })} style={{ width: 70, padding: "6px 8px", border: "1px solid var(--line)", borderRadius: 2, fontSize: 13 }} />
              </label>
            </div>
          </div>

          {/* 描述区（中文/英文各一行） */}
          {(["desc", "ingredients", "usage"] as const).map((field) => (
            <div key={field} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, color: "var(--ink-2)", marginBottom: 6 }}>
                  {field === "desc" ? "功效描述（中）" : field === "ingredients" ? "成分（中）" : "使用方式（中）"}
                </label>
                <input value={form[field].zh} onChange={(e) => setForm({ ...form, [field]: { ...form[field], zh: e.target.value } })} style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 2, fontSize: 14 }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, color: "var(--ink-2)", marginBottom: 6 }}>
                  {field === "desc" ? "功效描述（EN）" : field === "ingredients" ? "成分（EN）" : "使用方式（EN）"}
                </label>
                <input value={form[field].en} onChange={(e) => setForm({ ...form, [field]: { ...form[field], en: e.target.value } })} style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 2, fontSize: 14 }} />
              </div>
            </div>
          ))}

          {/* 图片列表（URL 直填，M6 前） */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, color: "var(--ink-2)", marginBottom: 6 }}>产品图片（至少 1 张，且仅 1 张主图）</label>
            {form.images.map((img, idx) => (
              <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <input
                  value={img.url}
                  onChange={(e) => updateImage(idx, { url: e.target.value })}
                  placeholder="https://cdn.haoyao.com/media/p1.webp"
                  style={{ flex: 1, padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 2, fontSize: 13 }}
                />
                <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--ink-2)" }}>
                  <input type="checkbox" checked={img.is_cover} onChange={(e) => updateImage(idx, { is_cover: e.target.checked })} />
                  主图
                </label>
                <button
                  onClick={() => setForm({ ...form, images: form.images.filter((_, i) => i !== idx) })}
                  style={{ fontSize: 12, color: "var(--red)" }}
                >
                  删除
                </button>
              </div>
            ))}
            <button
              onClick={() => setForm({ ...form, images: [...form.images, { url: "", is_cover: false }] })}
              style={{ fontSize: 12, color: "var(--gold-deep)", marginTop: 4 }}
            >
              + 添加图片
            </button>
          </div>

          {/* 操作区 */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 8 }}>
            <button onClick={() => setModalOpen(false)} style={{ padding: "8px 20px", border: "1px solid var(--line)", borderRadius: 2, fontSize: 13, color: "var(--ink-2)" }}>
              取消
            </button>
            <button onClick={handleSave} disabled={saving} style={{ padding: "8px 20px", background: "var(--hero-1)", color: "#fff", borderRadius: 2, fontSize: 13, opacity: saving ? 0.6 : 1 }}>
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        </Modal>
      </div>
    </>
  );
}
