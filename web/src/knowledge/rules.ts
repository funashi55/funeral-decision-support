import { z } from "zod";
import recordRaw from "./rules.record.json";
import raw from "./rules.json";
import { getDecision } from "../domain/decisions";

export const RuleSchema = z.object({
  id: z.string().regex(/^R-[a-z]+-\d{2}$/),
  topic: z.string(),
  when: z.string(),
  do: z.string(),
  why: z.string(),
  /** 元の発言・メモ（根拠へ戻れるようにする） */
  source: z.string().min(1),
  /** author_memo：作者のメモ／veteran_interview：ベテランの聞き取り／core_record：基幹システムの施行の記録 */
  origin: z.enum(["author_memo", "veteran_interview", "core_record"]),
  decisionIds: z.array(z.string()),
});

export const KnowledgeSchema = z.object({
  version: z.string(),
  note: z.string(),
  rules: z.array(RuleSchema),
});

export type Rule = z.infer<typeof RuleSchema>;
export type Knowledge = z.infer<typeof KnowledgeSchema>;

/** 知見を読み込み、形式と、参照している決定項目の存在を検証する */
export function loadKnowledge(input: unknown = raw): Knowledge {
  const knowledge = KnowledgeSchema.parse(input);
  for (const rule of knowledge.rules) {
    for (const id of rule.decisionIds) getDecision(id);
  }
  const ids = knowledge.rules.map((r) => r.id);
  if (new Set(ids).size !== ids.length) throw new Error("知見の id が重複しています");
  return knowledge;
}

/** 施行の記録から取り出した知見。聞き取りで知見（rules.json）を作り直しても、こちらは残る */
export function loadRecordKnowledge(): Knowledge {
  return loadKnowledge(recordRaw);
}

/** 聞き取り・メモの知見に、施行の記録の知見を足す（同じ id があれば先の知見を使う） */
export function withRecordRules(knowledge: Knowledge, record: Knowledge = loadRecordKnowledge()): Knowledge {
  const ids = new Set(knowledge.rules.map((r) => r.id));
  return { ...knowledge, rules: [...knowledge.rules, ...record.rules.filter((r) => !ids.has(r.id))] };
}

export function rulesFor(knowledge: Knowledge, decisionIds: readonly string[]): Rule[] {
  return knowledge.rules.filter((r) => r.decisionIds.some((id) => decisionIds.includes(id)));
}
