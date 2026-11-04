/**
 * 打合せの段階の判定（信頼関係 → ヒアリング → お別れの仕方 → 日程 → プラン → 手配）。
 * 直近の発言の言葉から決める。AI を使わないので、毎回同じ結果になる。
 *
 * 段階に合わせて推奨を出し分ける：信頼関係・ヒアリングの段階では金額を出さない。
 */
import { DECISIONS, PHASE_LABEL, type DecisionItem, type Phase } from "../domain/decisions";
import type { CaseState, Utterance } from "./case";

/** 段階を示す言葉。遺族の言い回しの揺れを拾えるよう、語幹で持つ */
const CUES: Readonly<Record<Exclude<Phase, "after">, readonly RegExp[]>> = {
  trust: [/ご愁傷/, /お悔やみ申し/, /亡くな/, /入院/, /最期/, /最後は/, /経緯/, /看取/, /病院/],
  hearing: [/来ていただ/, /来てほしい/, /参列/, /家族葬/, /一般葬/, /一日葬/, /火葬式/, /宗派/, /宗旨/, /お寺/, /菩提寺/, /住職/],
  farewell: [/湯灌/, /納棺/, /お顔/, /顔を見/, /お別れ/, /安置/, /エンバーミング/, /お体/, /清め/],
  schedule: [/火葬/, /日程/, /到着/, /着く/, /日後/, /通夜/, /何日/, /斎場/, /日にち/],
  plan: [/費用/, /予算/, /お金/, /祭壇/, /見積/, /プラン/, /料理/, /会食/, /香典返し/, /棺/],
  logistics: [/遺影/, /礼状/, /死亡届/, /お悔やみ欄/, /新聞/, /駐車/, /受付/, /司会/, /ペースメーカー/],
};

const ORDER: readonly Phase[] = ["trust", "hearing", "farewell", "schedule", "plan", "logistics", "after"];

/** 直近の何発言を見るか。直前の発言は重く見る */
const WINDOW = 3;
const CURRENT_WEIGHT = 3;

function scoreOf(text: string): Map<Phase, number> {
  const scores = new Map<Phase, number>();
  for (const [phase, cues] of Object.entries(CUES) as [Phase, readonly RegExp[]][]) {
    const hits = cues.filter((c) => c.test(text)).length;
    if (hits > 0) scores.set(phase, hits);
  }
  return scores;
}

export interface PhaseReading {
  readonly phase: Phase;
  readonly label: string;
  /** 判定の根拠になった発言 */
  readonly utteranceIds: readonly string[];
}

/** 発言の並びから、今の段階を判定する。手がかりがなければ信頼関係から始める */
export function detectPhase(utterances: readonly Utterance[]): PhaseReading {
  const recent = utterances.slice(-WINDOW);
  const total = new Map<Phase, number>();
  const evidence = new Map<Phase, string[]>();
  recent.forEach((u, i) => {
    const weight = i === recent.length - 1 ? CURRENT_WEIGHT : 1;
    for (const [phase, hits] of scoreOf(u.text)) {
      total.set(phase, (total.get(phase) ?? 0) + hits * weight);
      evidence.set(phase, [...(evidence.get(phase) ?? []), u.id]);
    }
  });
  if (total.size === 0) {
    const earlier = utterances.slice(0, -WINDOW);
    return earlier.length > 0 ? detectPhase(earlier) : { phase: "trust", label: PHASE_LABEL.trust, utteranceIds: [] };
  }
  // 同点なら、打合せの後ろの段階を取る（話が先に進んだとみなす）
  const [phase] = [...total.entries()].sort((a, b) => b[1] - a[1] || ORDER.indexOf(b[0]) - ORDER.indexOf(a[0]))[0]!;
  return { phase, label: PHASE_LABEL[phase], utteranceIds: evidence.get(phase) ?? [] };
}

/** 金額を担当者の画面に出してよい段階か。信頼関係とヒアリングのうちは出さない */
export function allowsPrices(phase: Phase): boolean {
  return ORDER.indexOf(phase) >= ORDER.indexOf("farewell");
}

/** 段階ごとの、担当者への一言（ベテランの進め方の知見から） */
export const PHASE_HINT: Readonly<Record<Phase, string>> = {
  trust: "段取りの前に、亡くなるまでの経緯とお別れの言葉を交わせたかを伺う段階です。費用の話はまだしません",
  hearing: "どなたに来ていただきたいか、故人らしさを伺う段階です。葬儀の形はここで決まります",
  farewell: "お別れの仕方を決める段階です。ご家族の言葉から、望むお別れを言葉にして確かめます",
  schedule: "お寺・斎場・遠方のご親族の都合から日程を組む段階です",
  plan: "プランと費用の段階です。費用を抑える案から並べ、含まれないものを先に伝えます",
  logistics: "手配と書類の段階です。取り消せない手配は、ご家族に確かめてから進めます",
  after: "葬儀後の段階です",
};

/** 今の段階で、今日決めるのにまだ決まっていない項目 */
export function focusDecisions(state: CaseState, phase: Phase): DecisionItem[] {
  return DECISIONS.filter((d) => d.phase === phase && d.urgency === "today" && state.decisions[d.id]?.status !== "confirmed");
}
