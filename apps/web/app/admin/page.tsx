import { redirect } from "next/navigation";

// ============================================================================
// HAOYAO 后台首页：M6 起重定向到仪表盘（M2 早期默认导航配置，已改为仪表盘）。
// ============================================================================

export default function AdminIndex() {
  redirect("/admin/dashboard");
}
