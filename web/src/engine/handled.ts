/**
 * 提案や注意が「済んだ」かどうか。済んだものは画面の下に畳み、いま要るものだけを残す。
 *
 * 済んだとみなすのは次のとき：
 * - 担当者が「伝えた／使わない」を押した
 * - 関係する項目を確定した
 * - 提案が出たあとに、担当者がその内容に触れた（例：「湯灌」「お体を洗い清める」と話した）
 */
import type { FarewellOptionId } from "../domain/farewell";
import type { CaseState, FeedbackVerdict } from "./case";

export type HandledBy = FeedbackVerdict | "confirmed" | "spoken";

/** 担当者がその選択肢に触れたとみなす言葉 */
export const FAREWELL_CUES: Readonly<Record<FarewellOptionId, readonly RegExp[]>> = {
  standard_laying: [/通常の納棺/, /身支度を整え/],
  yukan: [/湯灌/, /お体を(?:洗|清)/, /洗い清め/],
  embalming: [/エンバーミング/, /お顔を保つ/],
  extend_resting: [/日を延ば/, /延ばして/, /お待ちする/, /ゆっくりお別れ/],
};

/** 選択肢ごとに、確定したら済んだとみなす項目 */
export const FAREWELL_DECISION: Readonly<Record<FarewellOptionId, string>> = {
  standard_laying: "laying_in_style",
  yukan: "laying_in_style",
  embalming: "embalming",
  extend_resting: "cremation_date",
};

/** プランの提案に触れたとみなす言葉 */
export const PLAN_CUES: readonly RegExp[] = [/プラン/, /祭壇/, /こもれび|せせらぎ|ひだまり/];

/** 文から短い識別子を作る（尋ねることなど、ID のない提案のため） */
export function textKey(text: string): string {
  let h = 5381;
  for (const ch of text) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0;
  return h.toString(36);
}

/** 提案が出たあと（basedOn 番目の発言より後）に、担当者がその内容に触れたか */
export function spokenAfter(state: CaseState, basedOn: number, cues: readonly RegExp[]): boolean {
  return state.utterances.slice(basedOn).some((u) => u.speaker === "staff" && cues.some((c) => c.test(u.text)));
}

export interface HandledCheck {
  readonly target: string;
  readonly decisionId?: string;
  readonly cues?: readonly RegExp[];
  /** 提案が何番目の発言までを見て出たか */
  readonly basedOn?: number;
}

/** 済んでいれば、その理由を返す。済んでいなければ null */
export function handledBy(state: CaseState, check: HandledCheck): HandledBy | null {
  const fb = state.feedback.find((f) => f.target === check.target);
  if (fb) return fb.verdict;
  if (check.decisionId && state.decisions[check.decisionId]?.status === "confirmed") return "confirmed";
  if (check.cues && check.basedOn !== undefined && check.basedOn > 0 && spokenAfter(state, check.basedOn, check.cues)) return "spoken";
  return null;
}

export const HANDLED_LABEL: Readonly<Record<HandledBy, string>> = {
  told: "伝えた",
  unused: "使わない",
  confirmed: "確定した",
  spoken: "会話で触れた",
};
