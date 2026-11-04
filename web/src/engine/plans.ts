/**
 * 3つの幅での案（費用を抑えたい／しっかり飾りたい／感謝の気持ちを表したい）。
 * 価格の上下ではなく、家族の気持ちの幅として並べる。並びは費用を抑える案が先。
 * 金額はすべて pricing.ts で計算する。人数が決まっていない品目は金額に入れず、「人数が決まってから」と示す。
 */
import { ALTAR_PLANS, RANGE_LABEL, buildEstimate, type AltarPlan, type Estimate, type EstimateOption, type Range } from "../domain/pricing";
import type { CaseState } from "./case";

export interface PlanProposal {
  readonly range: Range;
  readonly rangeLabel: string;
  readonly planId: string;
  readonly planLabel: string;
  readonly includes: readonly string[];
  readonly estimate: Estimate;
  /** 見積もりに足した品目と、その理由（担当者が家族に説明できるように） */
  readonly additions: readonly { readonly label: string; readonly why: string }[];
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

interface Addition {
  readonly option: EstimateOption;
  readonly label: string;
  readonly why: string;
}

function additionsFor(state: CaseState, plan: AltarPlan): { additions: Addition[]; pending: string[] } {
  const additions: Addition[] = [];
  const pending: string[] = [];
  const days = state.profile.daysUntilFuneral;
  const extraDays = days === undefined ? 0 : Math.max(0, days - plan.includedDays);
  if (extraDays > 0) {
    additions.push({ option: { itemId: "dry_ice", quantity: extraDays }, label: "ドライアイスの追加", why: "火葬までの日数がプランに含まれる日数を超えるため" });
    if (!chose(state, "resting_place", /自宅/)) {
      additions.push({ option: { itemId: "resting_fee", quantity: extraDays }, label: "会館での安置料", why: "会館で安置する日数がプランに含まれる日数を超えるため" });
    }
  }
  if (state.profile.funeralStyle !== "火葬式") {
    additions.push({ option: { itemId: "hall_fee", quantity: 1 }, label: "会場使用料", why: "式を会館で行うため" });
  }
  if (chose(state, "laying_in_style", /湯灌/)) {
    additions.push({ option: { itemId: "yukan", quantity: 1 }, label: "湯灌", why: "ご家族が湯灌を選んだため" });
  }
  if (chose(state, "embalming", /行う|する|希望/) && !chose(state, "embalming", /行わない|しない/)) {
    additions.push({ option: { itemId: "embalming", quantity: 1 }, label: "エンバーミング", why: "ご家族がエンバーミングを選んだため" });
  }
  const guests = readCount(decisionValue(state, "meals")) ?? readCount(decisionValue(state, "attendees_scope"));
  const gifts = readCount(decisionValue(state, "return_gifts")) ?? readCount(decisionValue(state, "attendees_scope"));
  if (chose(state, "meals", /なし|しない|行わない/)) {
    // 会食をしないと決めた
  } else if (guests !== null) {
    additions.push({ option: { itemId: "meal", quantity: guests }, label: "会食", why: "参列の人数の目安から" });
  } else {
    pending.push("会食（人数が決まってから）");
  }
  if (gifts !== null) additions.push({ option: { itemId: "return_gift", quantity: gifts }, label: "香典返し", why: "参列の人数の目安から。余った分は返品できます" });
  else pending.push("香典返し（人数が決まってから）");
  return { additions, pending };
}

/** 3つの幅の案を、費用を抑える案から順に返す */
export function buildPlanProposals(state: CaseState): PlanProposal[] {
  return RANGES.map((range) => {
    const plan = ALTAR_PLANS.find((p) => p.range === range);
    if (!plan) throw new Error(`幅 ${range} のプランがありません`);
    const { additions, pending } = additionsFor(state, plan);
    const estimate = buildEstimate(plan.id, additions.map((a) => a.option));
    return {
      range,
      rangeLabel: RANGE_LABEL[range],
      planId: plan.id,
      planLabel: plan.label,
      includes: plan.includes,
      estimate,
      additions: additions.map(({ label, why }) => ({ label, why })),
      pendingCounts: pending,
    };
  });
}
