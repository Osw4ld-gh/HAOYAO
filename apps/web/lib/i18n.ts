// ============================================================================
// HAOYAO i18n 工具（lib/i18n.ts）
// 功能：静态文案字典加载 + t(key) 翻译函数。
// 依据：《HAOYAO_官网_开发技术文档.md》§7.4：
//   - 静态文案存 messages/zh.json、en.json
//   - 回退链：当前语言 → zh → key 本身（防白屏）
//   - 业务内容（_json 字段）渲染回退由各组件处理：content[lang] ?? zh ?? en ?? ""
// 说明：M5 将补充完整语言切换与字典管理；本模块 M1 提供骨架。
// ============================================================================

import en from "../messages/en.json";
import zh from "../messages/zh.json";

/** 支持的语言（中文站无前缀 / 英文站 /en） */
export type Locale = "zh" | "en";

/** 字典结构：嵌套 JSON（与 messages/*.json 结构一致） */
export interface Dict {
  [key: string]: string | Dict;
}

/** 语言 → 字典映射 */
const dictionaries: Record<Locale, Dict> = { zh, en };

/**
 * 翻译函数：按 key 路径读取当前语言文案。
 *
 * 回退链（技术文档 §7.4）：
 *   current[lang] 缺失 → zh → 返回 key 原文（绝对不白屏）
 *
 * 用法：t("nav.home", "zh") / t("home.slogan", locale)
 */
export function t(key: string, lang: string): string {
  const locale: Locale = lang === "en" ? "en" : "zh";
  // 先取当前语言字典
  const current = lookup(dictionaries[locale], key);
  if (current !== undefined) return current;
  // 回退链第二级：中文（en 缺失时回退 zh）
  if (locale !== "zh") {
    const fallback = lookup(dictionaries.zh, key);
    if (fallback !== undefined) return fallback;
  }
  // 最终兜底：返回 key 本身（防止白屏）
  return key;
}

/** 按点分路径从嵌套字典取值（nav.home → dict.nav.home） */
function lookup(dict: Dict, key: string): string | undefined {
  const parts = key.split(".");
  let node: Dict | string = dict;
  for (const part of parts) {
    // 已遍历到字符串叶节点但还有剩余路径 → 路径不存在
    if (typeof node === "string") return undefined;
    const next: Dict | string | undefined = node[part];
    if (next === undefined) return undefined;
    node = next;
  }
  return typeof node === "string" ? node : undefined;
}

/**
 * 业务内容（_json 字段）渲染回退（技术文档 §7.4 / §8.3 双语缺省）：
 *   content[lang] ?? content.zh ?? content.en ?? ""
 */
export function pickJson(content: Record<string, string> | null | undefined, lang: string): string {
  if (!content) return "";
  const locale: Locale = lang === "en" ? "en" : "zh";
  return content[locale] ?? content.zh ?? content.en ?? "";
}
