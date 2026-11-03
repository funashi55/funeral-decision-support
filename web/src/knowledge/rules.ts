import { z } from "zod";
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
  origin: z.enum(["author_memo", "veteran_interview"]),
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

export function rulesFor(knowledge: Knowledge, decisionIds: readonly string[]): Rule[] {
  return knowledge.rules.filter((r) => r.decisionIds.some((id) => decisionIds.includes(id)));
}
