/**
 * 見落としの先回り。取り消せない手配や、後から気づくと取り返しのつかない確認を、
 * 打合せの言葉と決定の状態から、該当する場面で担当者に知らせる。
 *
 * 規則は決め打ち（AI を使わない）。文面は守る線の検査を通るものだけを置く（テストで確かめる）。
 */
import { getDecision } from "../domain/decisions";
import type { CaseState } from "./case";

export interface OversightRule {
  readonly id: string;
  /** どの決定に関わるか */
  readonly decisionId: string;
  /** 担当者への知らせ。金額・割合を含めない */
  readonly message: string;
  /** 発言に現れたら知らせる言葉 */
  readonly cues: readonly RegExp[];
  /** 決定の状態から知らせる条件（cues に当たらなくても知らせる） */
  readonly when?: (state: CaseState) => boolean;
}

export interface OversightAlert {
  readonly id: string;
  readonly decisionId: string;
  readonly decisionLabel: string;
  readonly message: string;
  /** 知らせのきっかけになった発言 */
  readonly utteranceIds: readonly string[];
}

const isConfirmed = (state: CaseState, id: string): boolean => state.decisions[id]?.status === "confirmed";
const isMentioned = (state: CaseState, id: string): boolean => state.decisions[id] !== undefined;

export const OVERSIGHT_RULES: readonly OversightRule[] = [
  {
    id: "obituary_unnotified",
    decisionId: "obituary",
    message: "お悔やみ欄は掲載すると取り消せません。亡くなったことをまだ伝えていないご親族やご友人がいないか、先に確かめてください",
    cues: [/お悔やみ欄/, /新聞/, /掲載/],
  },
  {
    id: "pacemaker_before_cremation",
    decisionId: "pacemaker",
    message: "火葬の日取りの話が出ています。火葬の前に、ペースメーカーなど体内の機器の有無を確かめてください",
    cues: [/ペースメーカー/, /心臓の機械/],
    when: (s) => (isMentioned(s, "cremation_date") || s.utterances.some((u) => /火葬/.test(u.text))) && !isConfirmed(s, "pacemaker"),
  },
  {
    id: "temple_outside_city",
    decisionId: "temple",
    message: "お寺が遠方のようです。ご住職の都合を先に伺ってから、火葬と葬儀の日時を決めてください",
    cues: [/(市外|県外|遠方|遠く|実家).*(お寺|寺|住職)/, /(お寺|寺|住職).*(市外|県外|遠方|遠く)/],
  },
  {
    id: "relatives_before_cremation",
    decisionId: "relatives_arrival",
    message: "遠方のご親族の到着を待ってから、火葬の日時を決められます。到着の見込みを先に確かめてください",
    cues: [/(東京|大阪|遠方|海外|県外).*(着く|到着|来る)/, /日後/],
    when: (s) => isMentioned(s, "relatives_arrival") && !isConfirmed(s, "cremation_date"),
  },
  {
    id: "resting_days_not_included",
    decisionId: "resting_place",
    message: "火葬まで日があくため、安置の日数とドライアイスの追加はプランに含まれません。見積もりに入れて、先にお伝えしてください",
    cues: [],
    when: (s) => (s.profile.daysUntilFuneral ?? 0) >= 4 && !isConfirmed(s, "resting_place"),
  },
  {
    id: "yukan_before_laying_in",
    decisionId: "laying_in_style",
    message: "納棺の日時の話が出ています。湯灌を行うかは納棺の前までに決める必要があります。ご家族が望むかを先に伺ってください",
    cues: [],
    when: (s) => isMentioned(s, "laying_in_date") && !isConfirmed(s, "laying_in_style"),
  },
  {
    id: "budget_same_wallet",
    decisionId: "budget_scope",
    message: "費用の話が出ています。お墓や法要など、ほかの出費と同じ予算から出すのかを伺うと、無理のない範囲が分かります",
    cues: [/費用/, /予算/, /お金/],
    when: (s) => !isConfirmed(s, "budget_scope") && s.utterances.some((u) => /費用|予算|お金/.test(u.text)),
  },
  {
    id: "membership_before_estimate",
    decisionId: "membership",
    message: "見積もりの前に、互助会の会員かどうか（積立の有無）を確かめてください。積立があると見積もりが変わります",
    cues: [/見積/, /積立/, /会員/],
    when: (s) => isMentioned(s, "altar_plan") && !isConfirmed(s, "membership"),
  },
  {
    id: "return_gifts_returnable",
    decisionId: "return_gifts",
    message: "香典返しは余った分を返品できます。参列の人数が決まっていなくても、後から調整できるとお伝えできます",
    cues: [/香典返し/],
  },
];

/** 今の打合せで知らせるべき見落としを返す。確定済みの項目については知らせない */
export function detectOversights(state: CaseState, rules: readonly OversightRule[] = OVERSIGHT_RULES): OversightAlert[] {
  return rules.flatMap((rule) => {
    if (isConfirmed(state, rule.decisionId)) return [];
    const hits = state.utterances.filter((u) => rule.cues.some((c) => c.test(u.text))).map((u) => u.id);
    const byState = rule.when?.(state) ?? false;
    if (hits.length === 0 && !byState) return [];
    return [{ id: rule.id, decisionId: rule.decisionId, decisionLabel: getDecision(rule.decisionId).label, message: rule.message, utteranceIds: hits }];
  });
}
