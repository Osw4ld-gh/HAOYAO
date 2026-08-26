// ============================================================================
// HAOYAO revalidate 内部接口（app/api/revalidate/route.ts）
// 功能：接收后端写操作后的缓存刷新通知（revalidateTag）。
// 依据：《HAOYAO_官网_开发技术文档.md》§7.6：
//   - 请求头 x-admin-key 与 ADMIN_API_KEY 一致，否则 403（40300）
//   - Body: {"tags": ["products"]}；成功返回 {code:0, data:{revalidated:true}}
//   - 写操作与 tags 映射见技术文档 §5.7
// ============================================================================

import { revalidateTag } from "next/cache";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  // 1) 鉴权：内部接口密钥校验（防外部滥用刷新缓存）
  const adminKey = req.headers.get("x-admin-key");
  if (adminKey !== process.env.ADMIN_API_KEY) {
    return Response.json(
      { code: 40300, message: "forbidden", data: null },
      { status: 403 },
    );
  }

  // 2) 解析 tags 并逐项刷新 ISR 缓存
  try {
    const body = (await req.json()) as { tags?: string[] };
    const tags = Array.isArray(body.tags) ? body.tags : [];
    for (const tag of tags) {
      revalidateTag(tag);
    }
    return Response.json({ code: 0, message: "ok", data: { revalidated: true } });
  } catch {
    return Response.json(
      { code: 40000, message: "参数校验失败", data: null },
      { status: 400 },
    );
  }
}
