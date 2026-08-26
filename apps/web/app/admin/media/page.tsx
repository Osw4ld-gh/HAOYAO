"use client";

// ============================================================================
// HAOYAO 后台：媒体库页（app/admin/media/page.tsx）
// 功能：上传（校验提示：图片≤10MB / 视频≤200MB + 扩展名白名单）+ 网格列表
//       + 复制 CDN URL + 删除。
// 依据：PRD §5.6 媒体库 / 技术文档 §5.7（本地模拟存储上传接口）。
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";

import TopBar from "@/components/admin/TopBar";
import { AdminApiError, mediaApi, type MediaItem } from "@/lib/admin/client";

// 文件类型 → 大小上限（MB），与后端一致
const LIMIT_MB: Record<string, number> = { image: 10, video: 200 };
const ALLOWED_EXTS = ["jpg", "jpeg", "png", "webp", "gif", "mp4", "webm", "mov"];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export default function MediaPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<"all" | "image" | "video">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const PAGE_SIZE = 24;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await mediaApi.list({
        page,
        page_size: PAGE_SIZE,
        type: typeFilter === "all" ? undefined : typeFilter,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // 上传前校验（扩展名 + 大小）
  const validateFile = (file: File): string | null => {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXTS.includes(ext)) return "仅支持图片（jpg/png/webp/gif）或视频（mp4/webm/mov）";
    const mediaType = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) ? "image" : "video";
    const limit = LIMIT_MB[mediaType];
    if (file.size > limit * 1024 * 1024) return `文件超过大小限制（${mediaType} ≤ ${limit}MB）`;
    return null;
  };

  const doUpload = async (file: File) => {
    const err = validateFile(file);
    if (err) {
      setError(err);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      await mediaApi.upload(file);
      setPage(1);
      await load();
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "上传失败");
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) doUpload(file);
    e.target.value = ""; // 允许重复选择同一文件
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) doUpload(file);
  };

  // 复制 URL（剪贴板 API）
  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      window.alert("已复制 CDN URL");
    } catch {
      window.alert(url);
    }
  };

  const handleDelete = async (item: MediaItem) => {
    if (!window.confirm(`确认删除「${item.filename}」？`)) return;
    try {
      await mediaApi.remove(item.id);
      await load();
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "删除失败");
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <TopBar title="媒体库" />
      <div style={{ padding: "28px 32px 60px" }}>
        {/* 上传区（拖拽 + 点击） */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? "var(--gold)" : "var(--line)"}`,
            background: dragOver ? "rgba(169,142,95,0.06)" : "var(--bg-soft)",
            borderRadius: 4,
            padding: "40px 24px",
            textAlign: "center",
            cursor: "pointer",
            marginBottom: 24,
          }}
        >
          <div style={{ fontSize: 15, letterSpacing: "0.08em", color: "var(--ink)" }}>
            {uploading ? "上传中…" : "点击或拖拽文件到此处上传"}
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-3)" }}>
            图片 ≤ 10MB（jpg/png/webp/gif）· 视频 ≤ 200MB（mp4/webm/mov）
          </div>
          <input ref={fileInputRef} type="file" hidden onChange={handleFileChange} />
        </div>

        {error && (
          <div style={{ padding: "10px 12px", marginBottom: 16, fontSize: 13, color: "var(--red)", background: "rgba(166,61,61,0.08)", borderRadius: 4 }}>
            {error}
          </div>
        )}

        {/* 类型过滤 */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
          {(["all", "image", "video"] as const).map((type) => (
            <button
              key={type}
              onClick={() => {
                setTypeFilter(type);
                setPage(1);
              }}
              style={{
                padding: "6px 16px",
                fontSize: 13,
                borderRadius: 4,
                background: typeFilter === type ? "var(--hero-1)" : "transparent",
                color: typeFilter === type ? "#fff" : "var(--ink-2)",
              }}
            >
              {type === "all" ? `全部（${total}）` : type === "image" ? "图片" : "视频"}
            </button>
          ))}
        </div>

        {/* 媒体网格 */}
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--ink-3)" }}>加载中…</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", color: "var(--ink-3)" }}>暂无媒体资源</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {items.map((item) => (
              <div key={item.id} style={{ border: "1px solid var(--line)", background: "#fff" }}>
                {/* 预览 */}
                <div style={{ aspectRatio: "4 / 3", background: "var(--bg-soft)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {item.type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.url} alt={item.filename} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--ink-3)", letterSpacing: "0.2em" }}>VIDEO</span>
                  )}
                </div>
                {/* 信息 + 操作 */}
                <div style={{ padding: 10 }}>
                  <div style={{ fontSize: 12, color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.filename}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 11, color: "var(--ink-3)" }}>
                    {item.type === "image" ? "图片" : "视频"} · {formatSize(item.size)}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button onClick={() => copyUrl(item.url)} style={{ fontSize: 12, color: "var(--gold-deep)" }}>复制 URL</button>
                    <button onClick={() => handleDelete(item)} style={{ fontSize: 12, color: "var(--red)" }}>删除</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 分页 */}
        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 24 }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={{ padding: "6px 14px", border: "1px solid var(--line)", fontSize: 13, opacity: page <= 1 ? 0.4 : 1 }}>
              上一页
            </button>
            <span style={{ padding: "6px 8px", fontSize: 13 }}>{page} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={{ padding: "6px 14px", border: "1px solid var(--line)", fontSize: 13, opacity: page >= totalPages ? 0.4 : 1 }}>
              下一页
            </button>
          </div>
        )}
      </div>
    </>
  );
}
