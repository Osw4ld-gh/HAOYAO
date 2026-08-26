"use client";

// ============================================================================
// HAOYAO 后台登录页（app/admin/login/page.tsx）
// 功能：管理员登录 —— 密码登录 + 限流提示（剩余次数 / 账号锁定时间）。
// 依据：UI 规范 §4.2 登录页（居中卡片 + 品牌金）+ 技术文档 §6.3：
//   - 40102：密码错误，提示剩余次数
//   - 40103：账号锁定（423），展示解锁时间
//   - 成功后 access_token 存 localStorage，跳转 /admin/navigation
// ============================================================================

import { useState } from "react";
import { useRouter } from "next/navigation";

import { AdminApiError, authApi, setAccessToken } from "@/lib/admin/client";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await authApi.login(username.trim(), password);
      setAccessToken(data.access_token);
      router.replace("/admin/navigation");
    } catch (err) {
      // 错误提示：40103 携带锁定时间；40102 携带剩余次数（message 已含）
      if (err instanceof AdminApiError) {
        if (err.code === 40103) {
          const lockedUntil = (err.data as { locked_until?: string } | null)?.locked_until;
          setError(
            `连续失败次数过多，账号已锁定${lockedUntil ? `（解锁时间 ${lockedUntil}）` : " 15 分钟"}`,
          );
        } else {
          setError(err.message);
        }
      } else {
        setError("网络连接失败，请稍后重试");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-admin)",
      }}
    >
      {/* 登录卡片（UI 规范 §2.4 登录阴影） */}
      <form
        onSubmit={handleSubmit}
        style={{
          width: 380,
          padding: "48px 40px",
          background: "#fff",
          boxShadow: "var(--shadow-login)",
          borderRadius: "var(--radius-admin)",
        }}
      >
        {/* 品牌区 */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: "0.28em", color: "var(--ink)" }}>
            HAOYAO
          </div>
          <div style={{ fontSize: 12, letterSpacing: "0.2em", color: "var(--gold-deep)", marginTop: 8 }}>
            皓启纯净 · 遥见本真
          </div>
        </div>

        {/* 用户名 */}
        <label style={{ display: "block", fontSize: 13, color: "var(--ink-2)", marginBottom: 6 }}>
          用户名
        </label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="admin"
          autoComplete="username"
          style={{
            width: "100%",
            padding: "10px 12px",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-admin)",
            fontSize: 14,
            marginBottom: 18,
            outline: "none",
          }}
        />

        {/* 密码 */}
        <label style={{ display: "block", fontSize: 13, color: "var(--ink-2)", marginBottom: 6 }}>
          密码
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
          style={{
            width: "100%",
            padding: "10px 12px",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-admin)",
            fontSize: 14,
            marginBottom: 18,
            outline: "none",
          }}
        />

        {/* 错误提示（限流/锁定） */}
        {error && (
          <div
            style={{
              padding: "10px 12px",
              marginBottom: 16,
              fontSize: 13,
              color: "var(--red)",
              background: "rgba(166,61,61,0.08)",
              borderRadius: "var(--radius-admin)",
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !username.trim() || !password}
          style={{
            width: "100%",
            padding: "12px",
            background: "var(--hero-1)",
            color: "#fff",
            fontSize: 14,
            letterSpacing: "0.2em",
            borderRadius: "var(--radius-admin)",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "登录中…" : "登 录"}
        </button>
      </form>
    </div>
  );
}
