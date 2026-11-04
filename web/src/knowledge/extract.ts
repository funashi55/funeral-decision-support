/**
 * 聞き取りから取り出した知見の取りまとめと検査。
 *
 * テーマ別のサブエージェント（.claude/skills/veteran-knowledge）が、聞き取りの文字起こしから
 * 「こういう時はこうする」を元の発言つきで取り出し、テーマごとの断片に書く。
 * ここでは断片を1つの知見にまとめ、すべての規則が元の発言に戻れることを確かめる。
 */
import { z } from "zod";
import { DECISIONS } from "../domain/decisions";
import { KnowledgeSchema, loadKnowledge, type Knowledge, type Rule } from "./rules";

export const THEMES = ["flow", "farewell", "schedule", "plan", "logistics"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_LABEL: Record<Theme, string> = {
  flow: "進め方",
  farewell: "お別れの仕方",
  schedule: "日程",
  plan: "プランと費用",
  logistics: "見落としと手配",
};

/** サブエージェントが書く断片の1件（id は取りまとめで振る） */
export const FragmentRuleSchema = z.object({
  when: z.string().min(1),
  do: z.string().min(1),
  why: z.string().min(1),
  /** 聞き取りの文字起こしから、そのまま抜き出した発言 */
  quote: z.string().min(4),
  decisionIds: z.array(z.enum(DECISIONS.map((d) => d.id) as [string, ...string[]])).min(1),
});

export const FragmentSchema = z.object({ theme: z.enum(THEMES), rules: z.array(FragmentRuleSchema) });
export type Fragment = z.infer<typeof FragmentSchema>;

/** 句読点・空白・改行の違いは無視して比べる（文字起こしの整形の揺れを吸収する） */
export function normalize(text: string): string {
  return text.replace(/[\s、。,.，．「」『』…・!?！？]/g, "");
}

export interface TraceProblem {
  readonly ruleId: string;
  readonly problem: string;
}

/** 聞き取り由来の規則が、文字起こしの中に元の発言を持つかを確かめる */
export function traceToTranscript(knowledge: Knowledge, transcript: string): TraceProblem[] {
  const body = normalize(transcript);
  return knowledge.rules
    .filter((r) => r.origin === "veteran_interview")
    .flatMap((r) => (body.includes(normalize(r.source)) ? [] : [{ ruleId: r.id, problem: `元の発言が文字起こしに見つかりません：「${r.source.slice(0, 30)}」` }]));
}

/** 中身が同じ規則（同じ発言を同じ決定に結びつけたもの）を1つにする */
function dedupe(rules: readonly (Fragment["rules"][number] & { theme: Theme })[]): (Fragment["rules"][number] & { theme: Theme })[] {
  const seen = new Set<string>();
  return rules.filter((r) => {
    const key = `${normalize(r.quote)}|${[...r.decisionIds].sort().join(",")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** テーマ別の断片を、1つの知見にまとめる。id はテーマごとに振り直す */
export function mergeFragments(fragments: readonly Fragment[], version: string, note: string): Knowledge {
  const all = dedupe(fragments.flatMap((f) => FragmentSchema.parse(f).rules.map((r) => ({ ...r, theme: f.theme }))));
  const counters = new Map<Theme, number>();
  const rules: Rule[] = all.map((r) => {
    const n = (counters.get(r.theme) ?? 0) + 1;
    counters.set(r.theme, n);
    return {
      id: `R-${r.theme}-${String(n).padStart(2, "0")}`,
      topic: THEME_LABEL[r.theme],
      when: r.when,
      do: r.do,
      why: r.why,
      source: r.quote,
      origin: "veteran_interview",
      decisionIds: r.decisionIds,
    };
  });
  return loadKnowledge(KnowledgeSchema.parse({ version, note, rules }));
}
