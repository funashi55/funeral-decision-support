/**
 * 3つの幅での案（祭壇は小さめ／中くらい／大きめ）。
 * 価格の上下ではなく、家族の気持ちの幅として並べる。並びは費用を抑える案が先。
 * 金額はすべて pricing.ts で計算する。人数が決まっていない品目は金額に入れず、「人数が決まってから」と示す。
 */
import { ALTAR_PLANS, RANGE_LABEL, buildEstimate, type AltarPlan, type Estimate, type EstimateOption, type PriceTier, type Range } from "../domain/pricing";
import type { CaseState } from "./case";

export interface PlanProposal {
  readonly range: Range;
  readonly rangeLabel: string;
  readonly planId: string;
  readonly planLabel: string;
  readonly includes: readonly string[];
  readonly estimate: Estimate;
  /** 見積もりに足した品目と、その理由（担当者が家族に説明できるように）。会話から読んだものは、その発言と状態を添える */
  readonly additions: readonly AdditionNote[];
  /** 人数などが決まっていないため、まだ金額に入れていない品目 */
  readonly pendingCounts: readonly string[];
}

const RANGES: readonly Range[] = ["simple", "standard", "gratitude"];

/** 決定の値から人数を読む（例：「15名ほど」→ 15）。読めなければ null */
export function readCount(value: string | undefined): number | null {
  if (!value) return null;
  const m = value.match(/(\d+)\s*(?:名|人)/);
  return m ? Number(m[1]) : null;
}

const decisionValue = (state: CaseState, id: string): string | undefined => state.decisions[id]?.value;
const chose = (state: CaseState, id: string, pattern: RegExp): boolean => pattern.test(decisionValue(state, id) ?? "");

/** 見積もりの品目が、会話のどこから来たか */
export interface AdditionSource {
  readonly decisionId: string;
  /** candidate：会話から拾った候補（まだ確定していない）／confirmed：担当者が確定した */
  readonly status: "candidate" | "confirmed";
  readonly quote: string | null;
}

export interface AdditionNote {
  readonly label: string;
  readonly why: string;
  readonly quantity: number;
  readonly source: AdditionSource | null;
}

interface Addition extends AdditionNote {
  readonly option: EstimateOption;
}

/** 決定の値と、それを拾った発言 */
function sourceOf(state: CaseState, decisionId: string): AdditionSource | null {
  const d = state.decisions[decisionId];
  if (!d) return null;
  const id = d.utteranceIds.at(-1);
  return { decisionId, status: d.status === "confirmed" ? "confirmed" : "candidate", quote: state.utterances.find((u) => u.id === id)?.text ?? null };
}

const QUESTION = /(?:か|かね|でしょうか|ですか)[。？?]?\s*$|[？?]\s*$/;

/**
 * 有料のオプションを見積もりに入れてよいか。高いものへ誘導しないため、会話からの推測では入れない：
 * 確定しているか、ご家族がその言葉をはっきり口にした（問いかけではない）ときだけ
 */
function asked(state: CaseState, decisionId: string, value: RegExp, words: RegExp): boolean {
  const d = state.decisions[decisionId];
  if (!d || !value.test(d.value)) return false;
  if (d.status === "confirmed") return true;
  const quote = sourceOf(state, decisionId)?.quote ?? "";
  return words.test(quote) && !QUESTION.test(quote);
}

/** 火葬場への送迎車の台数：1台にお乗りいただける人数 */
const CAR_SEATS = 9;

function additionsFor(state: CaseState, plan: AltarPlan): { additions: Addition[]; pending: string[] } {
  const additions: Addition[] = [];
  const pending: string[] = [];
  const add = (itemId: string, quantity: number, label: string, why: string, decisionId: string | null): void => {
    if (quantity <= 0) return;
    additions.push({ option: { itemId, quantity }, label, why, quantity, source: decisionId ? sourceOf(state, decisionId) : null });
  };

  // 安置とドライアイス：火葬までの日数が、プランに含まれる日数を超えた分
  const days = state.profile.daysUntilFuneral;
  const extraDays = days === undefined ? 0 : Math.max(0, days - plan.includedDays);
  add("dry_ice", extraDays, "ドライアイスの追加", `火葬までの日数（${days ?? "?"}日）がプランに含まれる${plan.includedDays}日を超えるため`, "cremation_date");
  if (!chose(state, "resting_place", /自宅/) && days !== undefined) {
    add("resting_fee", Math.max(0, days - 1), "会館での安置", `火葬の前日まで会館で安置するため（${Math.max(0, days - 1)}泊）`, "resting_place");
  }
  if (state.profile.funeralStyle !== "火葬式" && !chose(state, "funeral_style", /火葬式|直葬/)) {
    add("hall_fee", chose(state, "wake_held", /行わない|しない|なし/) || chose(state, "funeral_style", /一日葬/) ? 1 : 2, "会場使用料", "式を会館で行うため（通夜と葬儀で2日、一日葬なら1日）", "funeral_style");
  }

  // お別れの仕方
  if (asked(state, "laying_in_style", /湯灌/, /湯灌/)) add("yukan", 1, "湯灌", "ご家族が湯灌を選んだため", "laying_in_style");
  if (asked(state, "embalming", /^(?!.*(?:行わない|しない)).*(?:行う|する|希望)/, /エンバーミング/)) add("embalming", 1, "エンバーミング", "ご家族がエンバーミングを選んだため", "embalming");
  if (asked(state, "coffin_items", /花/, /花/)) add("coffin_bouquet", 1, "棺上花束", "棺に花を入れてあげたいとお話があったため", "coffin_items");

  // 人数で決まるもの
  const guests = readCount(decisionValue(state, "meals")) ?? readCount(decisionValue(state, "attendees_scope"));
  const gifts = readCount(decisionValue(state, "return_gifts")) ?? readCount(decisionValue(state, "attendees_scope"));
  if (!chose(state, "meals", /なし|しない|行わない/)) {
    if (guests !== null) add("meal", guests, "料理", `${guests}名分（${readCount(decisionValue(state, "meals")) !== null ? "会食の人数" : "参列の人数の目安"}から）`, readCount(decisionValue(state, "meals")) !== null ? "meals" : "attendees_scope");
    else pending.push("料理（人数が決まってから）");
  }
  if (gifts !== null) add("return_gift", gifts, "香典返し", `${gifts}個（${readCount(decisionValue(state, "return_gifts")) !== null ? "香典返しの数" : "参列の人数の目安"}から）。余った分は返品できます`, readCount(decisionValue(state, "return_gifts")) !== null ? "return_gifts" : "attendees_scope");
  else pending.push("香典返し（人数が決まってから）");
  const party = readCount(decisionValue(state, "crematorium_party"));
  if (party !== null) add("crematory_car", Math.ceil(party / CAR_SEATS), "火葬場への送迎車", `火葬場へ行く${party}名を、1台${CAR_SEATS}名で`, "crematorium_party");

  // 手配
  if (asked(state, "obituary", /^(?!.*(?:なし|不要|しない|載せない|出さない)).*/, /お悔やみ欄|新聞/)) add("obituary", 1, "新聞のお悔やみ欄", "お悔やみ欄に載せるとお話があったため", "obituary");
  return { additions, pending };
}

/** 会員か一般か。「一般」「会員ではない」と決まったときだけ一般価格にし、それ以外は会員価格で見積もる */
export function priceTier(state: CaseState): PriceTier {
  return chose(state, "membership", /一般|員外|会員(?:では|じゃ)ない|入って(?:い)?ない|積立(?:は)?(?:ない|なし)/) ? "general" : "member";
}

/** 3つの幅の案を、費用を抑える案から順に返す */
export function buildPlanProposals(state: CaseState): PlanProposal[] {
  return RANGES.map((range) => {
    const plan = ALTAR_PLANS.find((p) => p.range === range);
    if (!plan) throw new Error(`幅 ${range} のプランがありません`);
    const { additions, pending } = additionsFor(state, plan);
    const estimate = buildEstimate(plan.id, additions.map((a) => a.option), priceTier(state));
    return {
      range,
      rangeLabel: RANGE_LABEL[range],
      planId: plan.id,
      planLabel: plan.label,
      includes: plan.includes,
      estimate,
      additions: additions.map(({ label, why, quantity, source }) => ({ label, why, quantity, source })),
      pendingCounts: pending,
    };
  });
}
