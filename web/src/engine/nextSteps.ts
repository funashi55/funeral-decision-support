/**
 * 次に進めること：やることリストの中から、会話の流れでいま進めるとよい項目を2〜3件押し上げる。
 * AI は使わない（打合せの最中にすぐ出し、毎回同じ理由で説明できるように）。
 *
 * 手がかり（強い順）：
 * - 見落とし注意がかかっている（取り消せない手配の前に確かめること）
 * - 直近の会話で話題に出た
 * - 会話から候補が出ていて、確定を待っている
 * - 前提の項目がそろって、決められるようになった
 * - いま話している段階の項目
 * 前提がまだの項目は下げ、「先に〇〇を」と添える
 */
import { DECISIONS, type DecisionItem, type Phase } from "../domain/decisions";
import type { CaseState } from "./case";
import type { OversightAlert } from "./oversight";
import { detectPhase } from "./phase";

/** 話題に出たとみなす言葉 */
export const TOPIC_CUES: Readonly<Record<string, readonly RegExp[]>> = {
  chief_mourner: [/喪主/],
  membership: [/互助会/, /会員/, /積立/, /積み立て/],
  attendees_scope: [/来て(?:いただ|ほし|もら)/, /参列/, /呼(?:ぶ|び)/],
  funeral_style: [/家族葬/, /一日葬/, /一般葬/, /火葬式/],
  wake_held: [/通夜/],
  religion: [/宗派/, /宗旨/],
  temple: [/お寺/, /菩提寺/, /住職/],
  laying_in_style: [/お風呂/, /湯灌/, /納棺/, /清め/],
  embalming: [/エンバーミング/],
  resting_place: [/安置/, /家に(?:帰|連れ)/],
  face_viewing: [/顔を見/, /お別れさせ/],
  relatives_arrival: [/着く/, /到着/, /帰って(?:くる|来る)/, /遠方/, /間に合/],
  cremation_date: [/火葬/, /日程/, /明後日/, /日後/],
  altar_plan: [/祭壇/, /プラン/],
  budget_scope: [/費用/, /予算/, /お金/, /抑え/],
  meals: [/料理/, /会食/, /食事/],
  obituary: [/お悔やみ欄/, /新聞/],
  photo: [/遺影/, /写真/],
  pacemaker: [/ペースメーカー/],
  death_certificate: [/死亡届/],
};

const PHASE_ORDER: readonly Phase[] = ["trust", "hearing", "farewell", "schedule", "plan", "logistics", "after"];
/** 直近の何発言を「いまの話題」とみなすか */
const RECENT = 4;
/** 押し上げる数 */
export const NEXT_STEPS_MAX = 3;

export interface NextStep {
  readonly item: DecisionItem;
  /** confirm：候補が出ているので確定する／ask：ご家族に確かめて入れる */
  readonly kind: "confirm" | "ask";
  readonly reason: string;
  readonly score: number;
}

const filled = (state: CaseState, id: string): boolean => state.decisions[id] !== undefined;
const short = (text: string, n: number): string => (text.length > n ? `${text.slice(0, n)}…` : text);

export function nextSteps(state: CaseState, oversights: readonly OversightAlert[]): NextStep[] {
  const phaseNow = PHASE_ORDER.indexOf(detectPhase(state.utterances).phase);
  const recent = state.utterances.slice(-RECENT);
  const steps: NextStep[] = [];

  for (const item of DECISIONS) {
    const d = state.decisions[item.id];
    if (d?.status === "confirmed") continue;
    const reasons: { readonly score: number; readonly text: string }[] = [];

    const alert = oversights.find((a) => a.decisionId === item.id);
    if (alert) reasons.push({ score: 6, text: short(alert.message.split("。")[0] ?? alert.message, 34) });

    const cues = TOPIC_CUES[item.id] ?? [];
    const said = [...recent].reverse().find((u) => cues.some((c) => c.test(u.text)));
    if (said) reasons.push({ score: 4, text: `「${short(said.text, 16)}」の話が出ています` });

    if (d?.status === "candidate") reasons.push({ score: 2, text: `会話から候補が出ています（${short(d.value, 14)}）` });

    const missing = item.dependsOn.filter((id) => !filled(state, id));
    if (item.dependsOn.length > 0 && missing.length === 0 && !d) reasons.push({ score: 2, text: "前提がそろい、決められるようになりました" });

    const gap = PHASE_ORDER.indexOf(item.phase) - phaseNow;
    const phaseScore = gap === 0 ? 2 : gap === 1 ? 1 : gap < 0 && item.urgency === "today" && !d ? 1 : 0;
    if (phaseScore > 0 && reasons.length === 0) reasons.push({ score: phaseScore, text: gap < 0 ? "まだ決まっていません" : "いまの話の流れで決められます" });
    else if (phaseScore > 0) reasons.push({ score: phaseScore, text: "" });

    let score = reasons.reduce((sum, r) => sum + r.score, 0);
    if (item.urgency === "later" && !said) score -= 2;
    if (missing.length > 0) score -= 3;
    if (score <= 0) continue;

    const main = reasons.filter((r) => r.text).sort((a, b) => b.score - a.score)[0]?.text ?? "";
    const before = missing.length > 0 ? `。先に「${short(DECISIONS.find((x) => x.id === missing[0])?.label ?? "", 12)}」を` : "";
    steps.push({ item, kind: d?.status === "candidate" ? "confirm" : "ask", reason: `${main}${before}`, score });
  }

  return steps.sort((a, b) => b.score - a.score || DECISIONS.indexOf(a.item) - DECISIONS.indexOf(b.item)).slice(0, NEXT_STEPS_MAX);
}
