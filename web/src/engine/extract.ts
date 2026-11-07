/**
 * 打合せの発言から、家族の事情・決定の候補・家族の条件を拾う（Haiku）。
 * AI が作るのは候補まで。確定は担当者が行う。
 */
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { DECISIONS, getDecision } from "../domain/decisions";
import type { CaseState, DecisionState, FamilyCircumstance, Utterance } from "./case";
import { EXTRACTABLE_FACTS, FACT_LABEL, applyFactCandidates } from "./facts";
import { MODEL_FAST, ModelOutputError, ModelRefusedError, getClient } from "./client";

const DECISION_IDS = DECISIONS.map((d) => d.id) as [string, ...string[]];

export const ExtractionSchema = z.object({
  circumstances: z.array(z.object({ text: z.string().describe("家族の事情を短く。推測を足さない"), utteranceIds: z.array(z.string()) })),
  candidates: z.array(
    z.object({
      decisionId: z.enum(DECISION_IDS),
      value: z.string().describe("候補の内容。家族がはっきり言ったことだけ"),
      utteranceIds: z.array(z.string()),
    }),
  ),
  facts: z
    .array(
      z.object({
        key: z.enum(EXTRACTABLE_FACTS),
        value: z.string().describe("はっきり言われた値だけ。年齢は数字だけ、性別は「女性」か「男性」"),
        utteranceIds: z.array(z.string()),
      }),
    )
    .describe("受付の事実（故人のお名前・年齢・性別・亡くなった場所・喪主のお名前）。会話ではっきり分かったものだけ"),
  profile: z.object({
    daysUntilFuneral: z.number().int().min(0).max(30).nullable().describe("会話から分かる場合のみ。分からなければ null"),
    deceasedAge: z.number().int().min(0).max(120).nullable(),
    funeralStyle: z.enum(["家族葬", "一般葬", "一日葬", "火葬式"]).nullable(),
  }),
});

export type Extraction = z.infer<typeof ExtractionSchema>;

const SYSTEM = `葬儀の打合せの発言から、担当者のメモになる情報を拾います。
- 家族がはっきり言ったことだけを拾い、推測を足さない
- 決定の候補は、家族の希望として言葉にされたものだけ。担当者の説明は候補にしない
- 各項目に、根拠になった発言の ID を必ず付ける
- 受付の事実（facts）は、会話ではっきり分かったものだけ。「母」「父」などの呼び方から性別を推し量ってよいが、名前を作らない
受付の事実：
${EXTRACTABLE_FACTS.map((k) => `${k}：${FACT_LABEL[k]}`).join("\n")}
決定項目の一覧：
${DECISIONS.map((d) => `${d.id}：${d.label}`).join("\n")}`;

export function formatUtterances(utterances: readonly Utterance[]): string {
  return utterances.map((u) => `[${u.id}] ${u.speakerLabel}：${u.text}`).join("\n");
}

export async function extractFromUtterances(utterances: readonly Utterance[]): Promise<Extraction> {
  const response = await getClient().messages.parse({
    model: MODEL_FAST,
    max_tokens: 4000,
    system: SYSTEM,
    output_config: { effort: "low", format: zodOutputFormat(ExtractionSchema) },
    messages: [{ role: "user", content: formatUtterances(utterances) }],
  });
  if (response.stop_reason === "refusal") throw new ModelRefusedError(null);
  if (!response.parsed_output) throw new ModelOutputError("抽出の結果を読み取れませんでした");
  return response.parsed_output;
}

/** 抽出結果を案件の状態に反映する。確定済みの決定は上書きしない。存在しない発言 ID は捨てる */
export function applyExtraction(state: CaseState, extraction: Extraction): CaseState {
  const known = new Set(state.utterances.map((u) => u.id));
  const keep = (ids: readonly string[]): string[] => ids.filter((id) => known.has(id));

  const circumstances: FamilyCircumstance[] = extraction.circumstances
    .map((c, i) => ({ id: `C${i + 1}`, text: c.text, utteranceIds: keep(c.utteranceIds) }))
    .filter((c) => c.utteranceIds.length > 0);

  const decisions: Record<string, DecisionState> = { ...state.decisions };
  for (const c of extraction.candidates) {
    getDecision(c.decisionId);
    if (decisions[c.decisionId]?.status === "confirmed") continue;
    const utteranceIds = keep(c.utteranceIds);
    if (utteranceIds.length === 0) continue;
    decisions[c.decisionId] = { value: c.value, status: "candidate", utteranceIds };
  }

  const p = extraction.profile;
  const profile = {
    ...state.profile,
    ...(p.daysUntilFuneral !== null ? { daysUntilFuneral: p.daysUntilFuneral } : {}),
    ...(p.deceasedAge !== null ? { deceasedAge: p.deceasedAge } : {}),
    ...(p.funeralStyle !== null ? { funeralStyle: p.funeralStyle } : {}),
  };
  return applyFactCandidates({ ...state, circumstances, decisions, profile }, extraction.facts ?? []);
}

/** 担当者が確定する。AI からは呼ばない */
export function confirmDecision(state: CaseState, decisionId: string, value: string): CaseState {
  getDecision(decisionId);
  const prev = state.decisions[decisionId];
  return {
    ...state,
    decisions: { ...state.decisions, [decisionId]: { value, status: "confirmed", utteranceIds: prev?.utteranceIds ?? [] } },
  };
}
