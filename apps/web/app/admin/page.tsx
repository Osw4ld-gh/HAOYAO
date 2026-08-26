import { redirect } from "next/navigation";

// ============================================================================
// HAOYAO 后台首页：重定向到导航配置（M2 首个可用模块）。
// ============================================================================

export default function AdminIndex() {
  redirect("/admin/navigation");
}
