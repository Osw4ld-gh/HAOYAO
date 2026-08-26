"use client";

// ============================================================================
// HAOYAO 后台：内容管理页（app/admin/content/page.tsx）
// 功能：三 Tab —— 品牌故事（双语编辑+保存）/ 发展历程（时间轴 CRUD）
//       / 资讯（company|industry Tab + 列表 + 双语弹层 + 草稿发布 + 待翻译标记）。
// 依据：UI 规范 §6.5 内容管理 / 方案 §4-M4：
//   - 故事：UPSERT 固定单行；双语分栏编辑
//   - 时间轴：年份倒序展示
//   - 资讯：草稿-发布状态机（发布写 published_at），待翻译标记
// ============================================================================

import { useCallback, useEffect, useState } from "react";

import Modal from "@/components/admin/Modal";
import TopBar from "@/components/admin/TopBar";
import {
  AdminApiError,
  articleApi,
  storyApi,
  timelineApi,
  type ArticlePayload,
  type StoryPayload,
  type TimelinePayload,
} from "@/lib/admin/client";

type ContentTab = "story" | "timeline" | "articles";

const EMPTY_STORY: StoryPayload = { title: { zh: "", en: "" }, content: { zh: "", en: "" }, hero_image: "" };
const EMPTY_TIMELINE: TimelinePayload = { year: 2026, title: { zh: "", en: "" }, desc: { zh: "", en: "" }, image_url: "", sort: 0 };
const EMPTY_ARTICLE: ArticlePayload = {
  category: "company",
  title: { zh: "", en: "" },
  summary: { zh: "", en: "" },
  content: { zh: "", en: "" },
  cover_url: "",
};

export default function ContentPage() {
  const [tab, setTab] = useState<ContentTab>("story");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 品牌故事状态
  const [story, setStory] = useState<StoryPayload>(EMPTY_STORY);
  // 时间轴状态
  const [timeline, setTimeline] = useState<(TimelinePayload & { id: number })[]>([]);
  const [tlModal, setTlModal] = useState(false);
  const [tlEditing, setTlEditing] = useState<(TimelinePayload & { id: number }) | null>(null);
  const [tlForm, setTlForm] = useState<TimelinePayload>(EMPTY_TIMELINE);
  // 资讯状态
  const [articles, setArticles] = useState<{ total: number; items: ArticleRow[] }>({ total: 0, items: [] });
  const [articleTab, setArticleTab] = useState<"all" | "company" | "industry">("all");
  const [artModal, setArtModal] = useState(false);
  const [artEditing, setArtEditing] = useState<ArticleRow | null>(null);
  const [artForm, setArtForm] = useState<ArticlePayload>(EMPTY_ARTICLE);

  // 加载当前 Tab 数据
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === "story") {
        const data = await storyApi.get();
        setStory({ title: data.title, content: data.content, hero_image: data.hero_image ?? "" });
      } else if (tab === "timeline") {
        setTimeline(await timelineApi.list());
      } else {
        const data = await articleApi.list({ category: articleTab === "all" ? undefined : articleTab, page_size: 50 });
        setArticles({ total: data.total, items: data.items });
      }
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [tab, articleTab]);

  useEffect(() => {
    load();
  }, [load]);

  // ---------- 品牌故事保存 ----------
  const saveStory = async () => {
    setSavingState("story");
    try {
      await storyApi.save(story);
      setError(null);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "保存失败");
    } finally {
      setSavingState(null);
    }
  };

  // ---------- 时间轴 CRUD ----------
  const openTlCreate = () => {
    setTlEditing(null);
    setTlForm(EMPTY_TIMELINE);
    setTlModal(true);
  };
  const openTlEdit = (item: TimelinePayload & { id: number }) => {
    setTlEditing(item);
    setTlForm({ year: item.year, title: { ...item.title }, desc: { ...item.desc }, image_url: item.image_url, sort: item.sort });
    setTlModal(true);
  };
  const saveTimeline = async () => {
    setSavingState("timeline");
    try {
      if (tlEditing) await timelineApi.update(tlEditing.id, tlForm);
      else await timelineApi.create(tlForm);
      setTlModal(false);
      await load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "保存失败");
    } finally {
      setSavingState(null);
    }
  };
  const deleteTimeline = async (item: TimelinePayload & { id: number }) => {
    if (!window.confirm(`确认删除时间轴「${item.year} ${item.title.zh}」？`)) return;
    try {
      await timelineApi.remove(item.id);
      await load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "删除失败");
    }
  };

  // ---------- 资讯 CRUD ----------
  const openArtCreate = () => {
    setArtEditing(null);
    setArtForm({ ...EMPTY_ARTICLE, category: articleTab === "industry" ? "industry" : "company" });
    setArtModal(true);
  };
  const openArtEdit = async (row: ArticleRow) => {
    try {
      const detail = await articleApi.get(row.id);
      setArtEditing(detail);
      setArtForm({
        category: detail.category,
        title: detail.title,
        summary: detail.summary,
        content: detail.content,
        cover_url: detail.cover_url,
      });
      setArtModal(true);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "加载资讯失败");
    }
  };
  const saveArticle = async () => {
    if (!artForm.title.zh.trim()) {
      setError("资讯中文标题必填");
      return;
    }
    setSavingState("articles");
    try {
      if (artEditing) await articleApi.update(artEditing.id, artForm);
      else await articleApi.create(artForm);
      setArtModal(false);
      await load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "保存失败");
    } finally {
      setSavingState(null);
    }
  };
  const publishArticle = async (row: ArticleRow) => {
    if (!window.confirm(`确认发布「${row.title.zh}」？发布后前台可见。`)) return;
    try {
      await articleApi.publish(row.id);
      await load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "发布失败");
    }
  };
  const deleteArticle = async (row: ArticleRow) => {
    if (!window.confirm(`确认删除资讯「${row.title.zh}」？`)) return;
    try {
      await articleApi.remove(row.id);
      await load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "删除失败");
    }
  };

  const [saving, setSavingState] = useState<string | null>(null);

  return (
    <>
      <TopBar title="内容管理" />
      <div style={{ padding: "28px 32px 60px" }}>
        {/* 三 Tab */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
          {(
            [
              { key: "story", label: "品牌故事" },
              { key: "timeline", label: "发展历程" },
              { key: "articles", label: "新闻资讯" },
            ] as { key: ContentTab; label: string }[]
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "8px 20px",
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

        {error && (
          <div style={{ padding: "10px 12px", marginBottom: 16, fontSize: 13, color: "var(--red)", background: "rgba(166,61,61,0.08)", borderRadius: 4 }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--ink-3)" }}>加载中…</div>
        ) : (
          <>
            {/* ============ 品牌故事 ============ */}
            {tab === "story" && (
              <div style={{ maxWidth: 760 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                  <Field label="中文标题">
                    <input value={story.title.zh} onChange={(e) => setStory({ ...story, title: { ...story.title, zh: e.target.value } })} style={inputStyle} />
                  </Field>
                  <Field label="英文标题">
                    <input value={story.title.en} onChange={(e) => setStory({ ...story, title: { ...story.title, en: e.target.value } })} style={inputStyle} />
                  </Field>
                </div>
                <Field label="首屏大图 URL">
                  <input value={story.hero_image} onChange={(e) => setStory({ ...story, hero_image: e.target.value })} placeholder="https://cdn.haoyao.com/media/story.webp" style={inputStyle} />
                </Field>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
                  <Field label="正文（中文）">
                    <textarea value={story.content.zh} onChange={(e) => setStory({ ...story, content: { ...story.content, zh: e.target.value } })} rows={8} style={{ ...inputStyle, height: 180, resize: "vertical" }} />
                  </Field>
                  <Field label="正文（英文）">
                    <textarea value={story.content.en} onChange={(e) => setStory({ ...story, content: { ...story.content, en: e.target.value } })} rows={8} style={{ ...inputStyle, height: 180, resize: "vertical" }} />
                  </Field>
                </div>
                <button onClick={saveStory} disabled={saving === "story"} style={{ marginTop: 20, padding: "9px 28px", background: "var(--hero-1)", color: "#fff", fontSize: 13, borderRadius: 2, opacity: saving === "story" ? 0.6 : 1 }}>
                  {saving === "story" ? "保存中…" : "保存故事"}
                </button>
              </div>
            )}

            {/* ============ 发展历程（时间轴） ============ */}
            {tab === "timeline" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <span style={{ fontSize: 13, color: "var(--ink-2)" }}>共 {timeline.length} 条（年份倒序）</span>
                  <button onClick={openTlCreate} style={{ padding: "8px 16px", background: "var(--hero-1)", color: "#fff", fontSize: 13, borderRadius: 2 }}>
                    + 新增条目
                  </button>
                </div>
                <div style={{ border: "1px solid var(--line)" }}>
                  {timeline.map((item) => (
                    <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>
                      <span style={{ width: 60, fontSize: 15, fontWeight: 500, color: "var(--gold-deep)" }}>{item.year}</span>
                      <span style={{ flex: 1, fontSize: 14, color: "var(--ink)" }}>
                        {item.title.zh}
                        <span style={{ marginLeft: 8, color: "var(--ink-3)", fontSize: 12 }}>{item.title.en || "—"}</span>
                      </span>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => openTlEdit(item)} style={{ fontSize: 12, color: "var(--ink-2)" }}>编辑</button>
                        <button onClick={() => deleteTimeline(item)} style={{ fontSize: 12, color: "var(--red)" }}>删除</button>
                      </div>
                    </div>
                  ))}
                  {timeline.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "var(--ink-3)" }}>暂无时间轴数据</div>}
                </div>
              </div>
            )}

            {/* ============ 新闻资讯 ============ */}
            {tab === "articles" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                  {/* 分类 Tab */}
                  <div style={{ display: "flex", gap: 4 }}>
                    {(["all", "company", "industry"] as const).map((c) => (
                      <button
                        key={c}
                        onClick={() => setArticleTab(c)}
                        style={{
                          padding: "6px 16px",
                          fontSize: 13,
                          borderRadius: 4,
                          background: articleTab === c ? "var(--hero-1)" : "transparent",
                          color: articleTab === c ? "#fff" : "var(--ink-2)",
                        }}
                      >
                        {c === "all" ? "全部" : c === "company" ? "企业新闻" : "行业资讯"}
                      </button>
                    ))}
                  </div>
                  <button onClick={openArtCreate} style={{ padding: "8px 16px", background: "var(--hero-1)", color: "#fff", fontSize: 13, borderRadius: 2 }}>
                    + 新增资讯
                  </button>
                </div>

                <div style={{ border: "1px solid var(--line)" }}>
                  {/* 表头 */}
                  <div style={{ display: "flex", gap: 12, padding: "8px 16px", background: "var(--bg-soft)", fontSize: 11, letterSpacing: "0.2em", color: "var(--ink-3)" }}>
                    <span style={{ flex: 2 }}>标题</span>
                    <span style={{ width: 80 }}>分类</span>
                    <span style={{ width: 70 }}>状态</span>
                    <span style={{ width: 150 }}>操作</span>
                  </div>
                  {articles.items.map((row) => (
                    <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderTop: "1px solid var(--line)" }}>
                      <span style={{ flex: 2, fontSize: 14, color: "var(--ink)" }}>
                        {row.title.zh}
                        <span style={{ marginLeft: 8, color: "var(--ink-3)", fontSize: 12 }}>{row.title.en || "—"}</span>
                        {!row.translation_complete && (
                          <span style={{ marginLeft: 8, padding: "1px 6px", fontSize: 10, color: "#fff", background: "var(--red)", borderRadius: 2 }}>待翻译</span>
                        )}
                      </span>
                      <span style={{ width: 80, fontSize: 12, color: "var(--ink-2)" }}>{row.category === "company" ? "企业" : "行业"}</span>
                      <span style={{ width: 70, fontSize: 12 }}>
                        <span style={{ padding: "2px 8px", borderRadius: 2, color: row.status === "published" ? "var(--green)" : "var(--ink-3)", background: row.status === "published" ? "rgba(95,122,91,0.12)" : "var(--bg-soft)" }}>
                          {row.status === "published" ? "已发布" : "草稿"}
                        </span>
                      </span>
                      <span style={{ width: 150, display: "flex", gap: 8 }}>
                        {row.status === "draft" && (
                          <button onClick={() => publishArticle(row)} style={{ fontSize: 12, color: "var(--green)" }}>发布</button>
                        )}
                        <button onClick={() => openArtEdit(row)} style={{ fontSize: 12, color: "var(--ink-2)" }}>编辑</button>
                        <button onClick={() => deleteArticle(row)} style={{ fontSize: 12, color: "var(--red)" }}>删除</button>
                      </span>
                    </div>
                  ))}
                  {articles.items.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "var(--ink-3)" }}>暂无资讯</div>}
                </div>
              </div>
            )}
          </>
        )}

        {/* ============ 时间轴弹层 ============ */}
        <Modal title={tlEditing ? `编辑时间轴（${tlEditing.year}）` : "新增时间轴"} open={tlModal} onClose={() => setTlModal(false)} width={620}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <Field label="年份 *">
              <input type="number" value={tlForm.year} onChange={(e) => setTlForm({ ...tlForm, year: Number(e.target.value) })} style={inputStyle} />
            </Field>
            <Field label="排序">
              <input type="number" value={tlForm.sort} onChange={(e) => setTlForm({ ...tlForm, sort: Number(e.target.value) })} style={inputStyle} />
            </Field>
            <Field label="标题（中）*">
              <input value={tlForm.title.zh} onChange={(e) => setTlForm({ ...tlForm, title: { ...tlForm.title, zh: e.target.value } })} style={inputStyle} />
            </Field>
            <Field label="标题（EN）">
              <input value={tlForm.title.en} onChange={(e) => setTlForm({ ...tlForm, title: { ...tlForm.title, en: e.target.value } })} style={inputStyle} />
            </Field>
          </div>
          <Field label="描述（中）">
            <textarea value={tlForm.desc.zh} onChange={(e) => setTlForm({ ...tlForm, desc: { ...tlForm.desc, zh: e.target.value } })} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
          </Field>
          <div style={{ height: 12 }} />
          <Field label="描述（EN）">
            <textarea value={tlForm.desc.en} onChange={(e) => setTlForm({ ...tlForm, desc: { ...tlForm.desc, en: e.target.value } })} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
          </Field>
          <div style={{ height: 12 }} />
          <Field label="配图 URL">
            <input value={tlForm.image_url} onChange={(e) => setTlForm({ ...tlForm, image_url: e.target.value })} placeholder="https://cdn.haoyao.com/media/tl.webp" style={inputStyle} />
          </Field>
          <ActionBar saving={saving === "timeline"} onCancel={() => setTlModal(false)} onSave={saveTimeline} />
        </Modal>

        {/* ============ 资讯弹层 ============ */}
        <Modal title={artEditing ? `编辑资讯：${artEditing.title.zh}` : "新增资讯"} open={artModal} onClose={() => setArtModal(false)} width={720}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <Field label="分类">
              <select value={artForm.category} onChange={(e) => setArtForm({ ...artForm, category: e.target.value as "company" | "industry" })} style={inputStyle}>
                <option value="company">企业新闻</option>
                <option value="industry">行业资讯</option>
              </select>
            </Field>
            <Field label="封面 URL">
              <input value={artForm.cover_url} onChange={(e) => setArtForm({ ...artForm, cover_url: e.target.value })} placeholder="https://cdn.haoyao.com/media/a.webp" style={inputStyle} />
            </Field>
            <Field label="标题（中）*">
              <input value={artForm.title.zh} onChange={(e) => setArtForm({ ...artForm, title: { ...artForm.title, zh: e.target.value } })} style={inputStyle} />
            </Field>
            <Field label="标题（EN）">
              <input value={artForm.title.en} onChange={(e) => setArtForm({ ...artForm, title: { ...artForm.title, en: e.target.value } })} style={inputStyle} />
            </Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="摘要（中）">
              <textarea value={artForm.summary.zh} onChange={(e) => setArtForm({ ...artForm, summary: { ...artForm.summary, zh: e.target.value } })} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
            </Field>
            <Field label="摘要（EN）">
              <textarea value={artForm.summary.en} onChange={(e) => setArtForm({ ...artForm, summary: { ...artForm.summary, en: e.target.value } })} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
            </Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
            <Field label="正文（中）">
              <textarea value={artForm.content.zh} onChange={(e) => setArtForm({ ...artForm, content: { ...artForm.content, zh: e.target.value } })} rows={6} style={{ ...inputStyle, resize: "vertical" }} />
            </Field>
            <Field label="正文（EN）">
              <textarea value={artForm.content.en} onChange={(e) => setArtForm({ ...artForm, content: { ...artForm.content, en: e.target.value } })} rows={6} style={{ ...inputStyle, resize: "vertical" }} />
            </Field>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-3)" }}>
            保存后为草稿（前台不可见），需在列表点「发布」后上线。
          </div>
          <ActionBar saving={saving === "articles"} onCancel={() => setArtModal(false)} onSave={saveArticle} />
        </Modal>
      </div>
    </>
  );
}

// ---------- 类型与辅助 ----------
interface ArticleRow {
  id: number;
  category: "company" | "industry";
  title: { zh: string; en: string };
  summary: { zh: string; en: string };
  content: { zh: string; en: string };
  cover_url: string;
  status: "draft" | "published";
  translation_complete: boolean;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  border: "1px solid var(--line)",
  borderRadius: 2,
  fontSize: 14,
  boxSizing: "border-box",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 13, color: "var(--ink-2)", marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

function ActionBar({ saving, onCancel, onSave }: { saving: boolean; onCancel: () => void; onSave: () => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 20 }}>
      <button onClick={onCancel} style={{ padding: "8px 20px", border: "1px solid var(--line)", borderRadius: 2, fontSize: 13, color: "var(--ink-2)" }}>
        取消
      </button>
      <button onClick={onSave} disabled={saving} style={{ padding: "8px 20px", background: "var(--hero-1)", color: "#fff", borderRadius: 2, fontSize: 13, opacity: saving ? 0.6 : 1 }}>
        {saving ? "保存中…" : "保存"}
      </button>
    </div>
  );
}
