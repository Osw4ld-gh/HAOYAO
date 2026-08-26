"use client";

// ============================================================================
// HAOYAO 后台：网站配置页（app/admin/config/page.tsx）
// 功能：6 Tab —— 轮播管理 / SEO 双语 / 显示开关 / 联系方式 / 账号安全 / 审计日志。
// 依据：PRD §5.7 网站配置 / 技术文档 §6.5.4：
//   - banner CRUD（含启停）
//   - site-config 部分更新（seo/switches/contact）
//   - 改密码（旧密码校验 + 新密码强度 + 重新登录）
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import Modal from "@/components/admin/Modal";
import TopBar from "@/components/admin/TopBar";
import {
  AdminApiError,
  bannerApi,
  changePassword,
  setAccessToken,
  siteConfigApi,
  type BannerPayload,
  type SiteConfig,
} from "@/lib/admin/client";

type ConfigTab = "banner" | "seo" | "switches" | "contact" | "account" | "audit";

const EMPTY_BANNER: BannerPayload = {
  image_url: "",
  title: { zh: "", en: "" },
  link_type: "url",
  link_value: "",
  sort: 0,
  enabled: true,
};

export default function ConfigPage() {
  const router = useRouter();
  const [tab, setTab] = useState<ConfigTab>("banner");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  // banner 状态
  const [banners, setBanners] = useState<(BannerPayload & { id: number })[]>([]);
  const [bannerModal, setBannerModal] = useState(false);
  const [bannerEditing, setBannerEditing] = useState<(BannerPayload & { id: number }) | null>(null);
  const [bannerForm, setBannerForm] = useState<BannerPayload>(EMPTY_BANNER);

  // site-config 状态
  const [config, setConfig] = useState<SiteConfig | null>(null);

  // 改密码状态
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");

  // 审计状态
  const [audits, setAudits] = useState<{ id: number; operator: string; action: string; target_type: string; target_id: string | null; detail: Record<string, unknown>; created_at: string }[]>([]);

  const loadBanners = useCallback(async () => {
    try {
      setBanners(await bannerApi.list());
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "加载轮播失败");
    }
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      setConfig(await siteConfigApi.get());
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "加载配置失败");
    }
  }, []);

  const loadAudits = useCallback(async () => {
    try {
      const stats = await dashboardStats();
      setAudits(stats.recent_audits);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "加载审计失败");
    }
  }, []);

  useEffect(() => {
    if (tab === "banner") loadBanners();
    else if (tab === "seo" || tab === "switches" || tab === "contact") loadConfig();
    else if (tab === "audit") loadAudits();
  }, [tab, loadBanners, loadConfig, loadAudits]);

  // ---------- banner CRUD ----------
  const openBannerCreate = () => {
    setBannerEditing(null);
    setBannerForm(EMPTY_BANNER);
    setBannerModal(true);
  };
  const openBannerEdit = (b: BannerPayload & { id: number }) => {
    setBannerEditing(b);
    setBannerForm({ ...b, title: { ...b.title } });
    setBannerModal(true);
  };
  const saveBanner = async () => {
    setSaving("save");
    try {
      if (bannerEditing) await bannerApi.update(bannerEditing.id, bannerForm);
      else await bannerApi.create(bannerForm);
      setBannerModal(false);
      await loadBanners();
      flash("轮播已保存");
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "保存失败");
    } finally {
      setSaving(null);
    }
  };
  const deleteBanner = async (b: BannerPayload & { id: number }) => {
    if (!window.confirm(`确认删除轮播「${b.title.zh || b.image_url}」？`)) return;
    try {
      await bannerApi.remove(b.id);
      await loadBanners();
      flash("轮播已删除");
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "删除失败");
    }
  };

  // ---------- site-config 保存 ----------
  const saveConfig = async (patch: Partial<SiteConfig>) => {
    setSaving("save");
    try {
      await siteConfigApi.update(patch);
      await loadConfig();
      flash("配置已保存");
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "保存失败");
    } finally {
      setSaving(null);
    }
  };

  // ---------- 改密码 ----------
  const submitChangePassword = async () => {
    if (newPwd !== confirmPwd) {
      setError("两次输入的新密码不一致");
      return;
    }
    if (newPwd.length < 8) {
      setError("新密码至少 8 位");
      return;
    }
    setSaving("save");
    try {
      await changePassword(oldPwd, newPwd);
      // 修改成功后强制重新登录（清 token 回登录页）
      setAccessToken(null);
      router.replace("/admin/login");
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "修改失败");
    } finally {
      setSaving(null);
    }
  };

  // 保存态：当前正在保存的子模块标识（banner/seo/switches/contact/pwd），null=空闲
  const [saving, setSaving] = useState<string | null>(null);
  const flash = (msg: string) => {
    setSaved(msg);
    setTimeout(() => setSaved(null), 2500);
  };

  return (
    <>
      <TopBar title="网站配置" />
      <div style={{ padding: "28px 32px 60px" }}>
        {/* 6 Tab */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, flexWrap: "wrap" }}>
          {(
            [
              { key: "banner", label: "轮播管理" },
              { key: "seo", label: "SEO 设置" },
              { key: "switches", label: "显示开关" },
              { key: "contact", label: "联系方式" },
              { key: "account", label: "账号安全" },
              { key: "audit", label: "审计日志" },
            ] as { key: ConfigTab; label: string }[]
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "8px 18px",
                fontSize: 13,
                borderRadius: 4,
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
        {saved && (
          <div style={{ padding: "10px 12px", marginBottom: 16, fontSize: 13, color: "var(--green)", background: "rgba(95,122,91,0.12)", borderRadius: 4 }}>
            {saved}
          </div>
        )}

        {/* ============ 轮播管理 ============ */}
        {tab === "banner" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 13, color: "var(--ink-2)" }}>共 {banners.length} 个轮播</span>
              <button onClick={openBannerCreate} style={{ padding: "8px 16px", background: "var(--hero-1)", color: "#fff", fontSize: 13, borderRadius: 2 }}>
                + 新增轮播
              </button>
            </div>
            <div style={{ border: "1px solid var(--line)" }}>
              {banners.map((b) => (
                <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>
                  {/* 预览 */}
                  <span style={{ width: 120, height: 48, overflow: "hidden", background: "var(--bg-soft)", flexShrink: 0 }}>
                    {b.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <span style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", fontSize: 10, color: "var(--ink-3)" }}>无图</span>
                    )}
                  </span>
                  <span style={{ flex: 1, fontSize: 14, color: "var(--ink)" }}>
                    {b.title.zh}
                    <span style={{ marginLeft: 8, color: "var(--ink-3)", fontSize: 12 }}>{b.title.en || "—"}</span>
                  </span>
                  <span style={{ fontSize: 12, color: "var(--ink-3)" }}>sort {b.sort}</span>
                  <span style={{ fontSize: 12 }}>
                    <span style={{ padding: "2px 8px", borderRadius: 2, color: b.enabled ? "var(--green)" : "var(--ink-3)", background: b.enabled ? "rgba(95,122,91,0.12)" : "var(--bg-soft)" }}>
                      {b.enabled ? "启用" : "停用"}
                    </span>
                  </span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => openBannerEdit(b)} style={{ fontSize: 12, color: "var(--ink-2)" }}>编辑</button>
                    <button onClick={() => deleteBanner(b)} style={{ fontSize: 12, color: "var(--red)" }}>删除</button>
                  </div>
                </div>
              ))}
              {banners.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "var(--ink-3)" }}>暂无轮播</div>}
            </div>
          </div>
        )}

        {/* ============ SEO 设置 ============ */}
        {tab === "seo" && config && (
          <div style={{ maxWidth: 720 }}>
            <SeoField label="网站标题（中）" value={config.seo.title.zh} onChange={(v) => setConfig({ ...config, seo: { ...config.seo, title: { ...config.seo.title, zh: v } } })} />
            <SeoField label="网站标题（EN）" value={config.seo.title.en} onChange={(v) => setConfig({ ...config, seo: { ...config.seo, title: { ...config.seo.title, en: v } } })} />
            <SeoField label="描述（中）" value={config.seo.description.zh} onChange={(v) => setConfig({ ...config, seo: { ...config.seo, description: { ...config.seo.description, zh: v } } })} />
            <SeoField label="描述（EN）" value={config.seo.description.en} onChange={(v) => setConfig({ ...config, seo: { ...config.seo, description: { ...config.seo.description, en: v } } })} />
            <SeoField label="关键词（中）" value={config.seo.keywords.zh} onChange={(v) => setConfig({ ...config, seo: { ...config.seo, keywords: { ...config.seo.keywords, zh: v } } })} />
            <SeoField label="关键词（EN）" value={config.seo.keywords.en} onChange={(v) => setConfig({ ...config, seo: { ...config.seo, keywords: { ...config.seo.keywords, en: v } } })} />
            <SeoField label="OG 分享图 URL" value={config.seo.og_image} onChange={(v) => setConfig({ ...config, seo: { ...config.seo, og_image: v } })} />
            <SaveButton saving={saving === "seo"} onClick={() => saveConfig({ seo: config.seo })} />
          </div>
        )}

        {/* ============ 显示开关 ============ */}
        {tab === "switches" && config && (
          <div style={{ maxWidth: 480 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0", borderBottom: "1px solid var(--line)" }}>
              <div>
                <div style={{ fontSize: 14, color: "var(--ink)" }}>显示价格</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)" }}>前台产品卡片与详情页是否展示价格</div>
              </div>
              <input type="checkbox" checked={config.switches.show_price} onChange={(e) => setConfig({ ...config, switches: { ...config.switches, show_price: e.target.checked } })} />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0", borderBottom: "1px solid var(--line)" }}>
              <div>
                <div style={{ fontSize: 14, color: "var(--ink)" }}>显示新品标签</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)" }}>产品卡是否展示「新品」红色标签</div>
              </div>
              <input type="checkbox" checked={config.switches.show_new_tag} onChange={(e) => setConfig({ ...config, switches: { ...config.switches, show_new_tag: e.target.checked } })} />
            </div>
            <SaveButton saving={saving === "switches"} onClick={() => saveConfig({ switches: config.switches })} />
          </div>
        )}

        {/* ============ 联系方式 ============ */}
        {tab === "contact" && config && (
          <div style={{ maxWidth: 720 }}>
            <SeoField label="电话（中）" value={config.contact.phone.zh} onChange={(v) => setConfig({ ...config, contact: { ...config.contact, phone: { ...config.contact.phone, zh: v } } })} />
            <SeoField label="电话（EN）" value={config.contact.phone.en} onChange={(v) => setConfig({ ...config, contact: { ...config.contact, phone: { ...config.contact.phone, en: v } } })} />
            <SeoField label="邮箱" value={config.contact.email} onChange={(v) => setConfig({ ...config, contact: { ...config.contact, email: v } })} />
            <SeoField label="地址（中）" value={config.contact.address.zh} onChange={(v) => setConfig({ ...config, contact: { ...config.contact, address: { ...config.contact.address, zh: v } } })} />
            <SeoField label="地址（EN）" value={config.contact.address.en} onChange={(v) => setConfig({ ...config, contact: { ...config.contact, address: { ...config.contact.address, en: v } } })} />
            <SaveButton saving={saving === "contact"} onClick={() => saveConfig({ contact: config.contact })} />
          </div>
        )}

        {/* ============ 账号安全（改密码） ============ */}
        {tab === "account" && (
          <div style={{ maxWidth: 420 }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, color: "var(--ink-2)", marginBottom: 6 }}>当前密码</label>
              <input type="password" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, color: "var(--ink-2)", marginBottom: 6 }}>新密码（≥8 位，含字母与数字）</label>
              <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, color: "var(--ink-2)", marginBottom: 6 }}>确认新密码</label>
              <input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} style={inputStyle} />
            </div>
            <button
              onClick={submitChangePassword}
              disabled={saving === "pwd" || !oldPwd || !newPwd || !confirmPwd}
              style={{ padding: "9px 28px", background: "var(--hero-1)", color: "#fff", fontSize: 13, borderRadius: 2, opacity: saving === "pwd" ? 0.6 : 1 }}
            >
              {saving === "pwd" ? "提交中…" : "修改密码"}
            </button>
            <div style={{ marginTop: 12, fontSize: 12, color: "var(--ink-3)" }}>修改成功后需使用新密码重新登录。</div>
          </div>
        )}

        {/* ============ 审计日志 ============ */}
        {tab === "audit" && (
          <div style={{ border: "1px solid var(--line)" }}>
            {audits.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "var(--ink-3)" }}>暂无操作记录</div>
            ) : (
              audits.map((a) => (
                <div key={a.id} style={{ display: "flex", gap: 16, padding: "10px 16px", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
                  <span style={{ width: 48, color: "var(--gold-deep)" }}>{a.action}</span>
                  <span style={{ width: 90, color: "var(--ink-2)" }}>{a.target_type}{a.target_id ? ` #${a.target_id}` : ""}</span>
                  <span style={{ flex: 1, color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.operator} {a.detail && Object.keys(a.detail).length ? `· ${JSON.stringify(a.detail).slice(0, 100)}` : ""}
                  </span>
                  <span style={{ color: "var(--ink-3)", fontSize: 12 }}>{a.created_at}</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* ============ Banner 弹层 ============ */}
        <Modal title={bannerEditing ? `编辑轮播 #${bannerEditing.id}` : "新增轮播"} open={bannerModal} onClose={() => setBannerModal(false)} width={640}>
          <Field label="图片 URL *">
            <input value={bannerForm.image_url} onChange={(e) => setBannerForm({ ...bannerForm, image_url: e.target.value })} placeholder="https://cdn.haoyao.com/media/b1.webp（可复制媒体库 URL）" style={inputStyle} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
            <Field label="标题（中）">
              <input value={bannerForm.title.zh} onChange={(e) => setBannerForm({ ...bannerForm, title: { ...bannerForm.title, zh: e.target.value } })} style={inputStyle} />
            </Field>
            <Field label="标题（EN）">
              <input value={bannerForm.title.en} onChange={(e) => setBannerForm({ ...bannerForm, title: { ...bannerForm.title, en: e.target.value } })} style={inputStyle} />
            </Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
            <Field label="链接类型">
              <select value={bannerForm.link_type} onChange={(e) => setBannerForm({ ...bannerForm, link_type: e.target.value as BannerPayload["link_type"] })} style={inputStyle}>
                <option value="url">外部链接</option>
                <option value="product">产品</option>
                <option value="article">资讯</option>
              </select>
            </Field>
            <Field label="链接目标">
              <input value={bannerForm.link_value} onChange={(e) => setBannerForm({ ...bannerForm, link_value: e.target.value })} placeholder="URL / 产品 id / 资讯 id" style={inputStyle} />
            </Field>
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 12, alignItems: "center" }}>
            <Field label="排序">
              <input type="number" value={bannerForm.sort} onChange={(e) => setBannerForm({ ...bannerForm, sort: Number(e.target.value) })} style={{ ...inputStyle, width: 100 }} />
            </Field>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-2)" }}>
              <input type="checkbox" checked={bannerForm.enabled} onChange={(e) => setBannerForm({ ...bannerForm, enabled: e.target.checked })} />
              启用
            </label>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 20 }}>
            <button onClick={() => setBannerModal(false)} style={{ padding: "8px 20px", border: "1px solid var(--line)", borderRadius: 2, fontSize: 13, color: "var(--ink-2)" }}>取消</button>
            <button onClick={saveBanner} disabled={saving === "banner"} style={{ padding: "8px 20px", background: "var(--hero-1)", color: "#fff", borderRadius: 2, fontSize: 13, opacity: saving === "banner" ? 0.6 : 1 }}>
              {saving === "banner" ? "保存中…" : "保存"}
            </button>
          </div>
        </Modal>
      </div>
    </>
  );
}

// 延迟 import 仪表盘接口（避免循环依赖；审计 Tab 复用）
async function dashboardStats() {
  const { dashboardApi } = await import("@/lib/admin/client");
  return dashboardApi.stats();
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

function SeoField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 13, color: "var(--ink-2)", marginBottom: 6 }}>{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
    </div>
  );
}

function SaveButton({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={saving} style={{ marginTop: 12, padding: "9px 28px", background: "var(--hero-1)", color: "#fff", fontSize: 13, borderRadius: 2, opacity: saving ? 0.6 : 1 }}>
      {saving ? "保存中…" : "保存"}
    </button>
  );
}
