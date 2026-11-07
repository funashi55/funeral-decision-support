/**
 * 見落としの先回り。取り消せない手配や、後から気づくと取り返しのつかない確認を、
 * 打合せの言葉と決定の状態から、該当する場面で担当者に知らせる。
 *
 * 規則は決め打ち（AI を使わない）。文面は守る線の検査を通るものだけを置く（テストで確かめる）。
 */
import { getDecision } from "../domain/decisions";
import type { CaseState } from "./case";

/** must：取り消せない・取り返しのつかないこと（いつも上に出す）／check：確かめておくとよいこと（畳んで出す） */
export type OversightLevel = "must" | "check";

export interface OversightRule {
  readonly id: string;
  /** 画面の見出し（同じ決定に関わる注意でも、中身で見分けられるように） */
  readonly title: string;
  readonly level: OversightLevel;
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
  readonly title: string;
  readonly level: OversightLevel;
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
    title: "お悔やみ欄は取り消せない",
    level: "must",
    decisionId: "obituary",
    message: "お悔やみ欄は掲載すると取り消せません。亡くなったことをまだ伝えていないご親族やご友人がいないか、先に確かめてください。葬儀の日時と住所を載せると留守宅が知られることもあるので、載せる内容と、香典を辞退するかの書き方もあわせて確かめてください",
    cues: [/お悔やみ欄/, /新聞/, /掲載/],
  },
  {
    id: "pacemaker_before_cremation",
    title: "火葬の前にペースメーカーの確認",
    level: "must",
    decisionId: "pacemaker",
    message: "火葬の日取りの話が出ています。火葬の前に、ペースメーカーなど体内の機器の有無を確かめてください",
    cues: [/ペースメーカー/, /心臓の機械/],
    when: (s) => (isMentioned(s, "cremation_date") || s.utterances.some((u) => /火葬/.test(u.text))) && !isConfirmed(s, "pacemaker"),
  },
  {
    id: "temple_outside_city",
    title: "市外の菩提寺の都合を先に",
    level: "must",
    decisionId: "temple",
    message: "お寺が遠方のようです。ご住職の都合を先に伺ってから、火葬と葬儀の日時を決めてください",
    cues: [/(市外|県外|遠方|遠く|実家).*(お寺|寺|住職)/, /(お寺|寺|住職).*(市外|県外|遠方|遠く)/],
  },
  {
    id: "relatives_before_cremation",
    title: "遠方の親族の到着を待って火葬の日を",
    level: "must",
    decisionId: "relatives_arrival",
    message: "遠方のご親族の到着を待ってから、火葬の日時を決められます。到着の見込みを先に確かめてください",
    cues: [/(東京|大阪|遠方|海外|県外).*(着く|到着|来る)/, /日後/],
    when: (s) => isMentioned(s, "relatives_arrival") && !isConfirmed(s, "cremation_date"),
  },
  {
    id: "resting_days_not_included",
    title: "安置の日数は別料金",
    level: "check",
    decisionId: "resting_place",
    message: "火葬まで日があく場合、安置の日数とドライアイスはプランとは別の料金になります。ご家族の予定を伺ったうえで、必要な分を見積もりでお示しください",
    cues: [],
    when: (s) => (s.profile.daysUntilFuneral ?? 0) >= 4 && !isConfirmed(s, "resting_place"),
  },
  {
    id: "yukan_before_laying_in",
    title: "湯灌は納棺の前まで",
    level: "check",
    decisionId: "laying_in_style",
    message: "湯灌を望まれる場合、手配は納棺の前までです。ご家族から話が出たときは、この期限をお伝えください",
    cues: [],
    when: (s) => isMentioned(s, "laying_in_date") && !isConfirmed(s, "laying_in_style"),
  },
  {
    id: "budget_same_wallet",
    title: "予算はほかの出費と同じ財布か",
    level: "check",
    decisionId: "budget_scope",
    message: "費用の話が出ています。お墓や法要など、ほかの出費と同じ予算から出すのかを伺うと、無理のない範囲が分かります",
    cues: [/費用/, /予算/, /お金/],
    when: (s) => !isConfirmed(s, "budget_scope") && s.utterances.some((u) => /費用|予算|お金/.test(u.text)),
  },
  {
    id: "membership_before_estimate",
    title: "見積もりの前に会員かどうか",
    level: "check",
    decisionId: "membership",
    message: "見積もりの前に、互助会の会員かどうか（積立の有無）を確かめてください。積立があると見積もりが変わります",
    cues: [/見積/, /積立/, /会員/],
    when: (s) => isMentioned(s, "altar_plan") && !isConfirmed(s, "membership"),
  },
  {
    id: "return_gifts_returnable",
    title: "香典返しの返品",
    level: "check",
    decisionId: "return_gifts",
    message: "香典返しは、余った分を返品できることが多い品です（業者と品物によります）。返品できるかを確かめたうえで、人数が決まっていなくても後から調整できるとお伝えできます",
    cues: [/香典返し/],
  },
  // 取り返しのつかない段取り
  {
    id: "permit_before_cremation",
    title: "火葬許可の段取り",
    level: "must",
    decisionId: "death_certificate",
    message: "火葬には火葬許可証が要ります。死亡診断書の受け取りと死亡届の提出を、誰がいつ行うかを確かめてください",
    cues: [/死亡届/, /死亡診断書/, /火葬許可/],
    when: (s) => (isMentioned(s, "cremation_date") || s.utterances.some((u) => /火葬/.test(u.text))) && !isConfirmed(s, "death_certificate"),
  },
  {
    id: "tomobiki",
    title: "友引の日に当たらないか",
    level: "must",
    decisionId: "cremation_date",
    message: "友引の日は休みの火葬場があります。候補の日が友引にあたらないか、ご家族の気にされ方と一緒に確かめてください",
    cues: [/友引/, /六曜/],
    when: (s) => isMentioned(s, "cremation_date") && !isConfirmed(s, "cremation_date"),
  },
  {
    id: "coffin_items_limits",
    title: "棺に入れられないもの",
    level: "must",
    decisionId: "coffin_items",
    message: "金属・ガラス・電池の入ったもの・厚い本などは棺に入れられません。入れてあげたいものを伺うときに、そっとお伝えください",
    cues: [/棺に入れ/, /お棺に/, /一緒に入れ/, /持たせ/],
  },
  {
    id: "photo_early",
    title: "遺影の写真は通夜の前に",
    level: "check",
    decisionId: "photo",
    message: "遺影の写真は、通夜の前に仕上げる必要があります。お気に入りの写真を選んでいただけるよう、早めにお願いしてください",
    cues: [/遺影/, /写真/],
    when: (s) => (isMentioned(s, "funeral_date") || isMentioned(s, "wake_date")) && !isConfirmed(s, "photo"),
  },
  // ご家族の思いと負担
  {
    id: "wishes_left",
    title: "故人が残した希望",
    level: "check",
    decisionId: "deceased_character",
    message: "故人が残した希望（エンディングノート・遺言・生前のお話）がないか、ご家族に伺ってください",
    cues: [/エンディングノート/, /遺言/, /生前/, /言い残/],
  },
  {
    id: "funeral_benefit",
    title: "葬祭費・埋葬料の申請",
    level: "check",
    decisionId: "budget_scope",
    message: "国民健康保険などの葬祭費や、勤め先の健康保険の埋葬料を受け取れることがあります（申請が必要です）。費用の話のときにお伝えできます",
    cues: [/保険/, /葬祭費/, /埋葬料/],
    when: (s) => s.utterances.some((u) => u.speaker !== "staff" && /費用|予算|お金|抑え/.test(u.text)),
  },
  {
    id: "offering_not_included",
    title: "お布施は見積もりに入らない",
    level: "check",
    decisionId: "estimate",
    message: "お布施は葬儀社の見積もりに含まれません。菩提寺がある場合は、お寺に直接お尋ねいただくことをお伝えください",
    cues: [/お布施/, /戒名/],
    when: (s) => isMentioned(s, "temple") && (isMentioned(s, "altar_plan") || s.utterances.some((u) => /費用|見積/.test(u.text))),
  },
];

/** 今の打合せで知らせるべき見落としを返す。確定済みの項目については知らせない */
export function detectOversights(state: CaseState, rules: readonly OversightRule[] = OVERSIGHT_RULES): OversightAlert[] {
  return rules.flatMap((rule) => {
    if (isConfirmed(state, rule.decisionId)) return [];
    const hits = state.utterances.filter((u) => rule.cues.some((c) => c.test(u.text))).map((u) => u.id);
    const byState = rule.when?.(state) ?? false;
    if (hits.length === 0 && !byState) return [];
    return [{ id: rule.id, title: rule.title, level: rule.level, decisionId: rule.decisionId, decisionLabel: getDecision(rule.decisionId).label, message: rule.message, utteranceIds: hits }];
  });
}

/** 推奨（AI）が選べる注意の ID（文章は書かせず、この一覧から選ばせる） */
export const OVERSIGHT_IDS = OVERSIGHT_RULES.map((r) => r.id) as [string, ...string[]];
