/**
 * 遺族の窓口に渡す情報。担当者の画面とは分ける。
 * 遺族に見せるのは「確定したこと」「これから決めること」「送った依頼」だけで、
 * AI の候補・会話の書き起こし・推奨は渡さない（遺族の窓口は評価や推奨をしない）。
 */
import { PHASE_LABEL, blockersOf, decisionOrder, getDecision } from "../domain/decisions";
import type { CaseState, FamilyRequest } from "./case";

/**
 * 担当者が確かめる項目で、遺族に「決めること」として見せないもの。
 * ご遺体の状態や医療機器の確認は担当者の仕事で、遺族の画面に並べると負担になる
 */
export const STAFF_ONLY_DECISIONS: ReadonlySet<string> = new Set(["body_condition", "pacemaker"]);

/** 「これから決めること」に並べる件数 */
export const UPCOMING_LIMIT = 5;

export interface FamilyDecided {
  readonly id: string;
  readonly label: string;
  readonly phase: string;
  readonly value: string;
  /** 後から変えられるか */
  readonly changeable: boolean;
}

export interface FamilyUpcoming {
  readonly id: string;
  readonly label: string;
  readonly phase: string;
  /** 今日のうちに決める必要があるか */
  readonly today: boolean;
}

export interface FamilyRequestView {
  readonly id: string;
  readonly kind: FamilyRequest["kind"];
  readonly decisionLabel: string | null;
  readonly text: string;
  readonly sentAt: number;
  readonly status: FamilyRequest["status"];
  readonly staffReply: string | null;
}

export interface FamilyView {
  readonly familyName: string;
  readonly decided: readonly FamilyDecided[];
  readonly upcoming: readonly FamilyUpcoming[];
  /** 「これから決めること」に並べきれなかった件数 */
  readonly moreUpcoming: number;
  readonly requests: readonly FamilyRequestView[];
}

export function toFamilyView(state: CaseState): FamilyView {
  const all = decisionOrder();
  const order = all.filter((d) => !STAFF_ONLY_DECISIONS.has(d.id));
  const confirmed = new Set(all.filter((d) => state.decisions[d.id]?.status === "confirmed").map((d) => d.id));

  const decided = order
    .filter((d) => confirmed.has(d.id))
    .map((d) => ({ id: d.id, label: d.label, phase: PHASE_LABEL[d.phase], value: state.decisions[d.id]!.value, changeable: d.reversible }));

  // 前提が決まっていて、いま決められるものを先に。そのうえで今日決めるものを先に
  const open = order.filter((d) => !confirmed.has(d.id));
  const ready = open.filter((d) => blockersOf(d.id, confirmed).length === 0);
  const ranked = [...ready.filter((d) => d.urgency === "today"), ...ready.filter((d) => d.urgency !== "today")];
  const upcoming = ranked.slice(0, UPCOMING_LIMIT).map((d) => ({ id: d.id, label: d.label, phase: PHASE_LABEL[d.phase], today: d.urgency === "today" }));

  const requests = state.requests.map((r) => ({
    id: r.id,
    kind: r.kind,
    decisionLabel: r.decisionId ? getDecision(r.decisionId).label : null,
    text: r.text,
    sentAt: r.sentAt,
    status: r.status,
    staffReply: r.staffReply,
  }));

  return { familyName: state.familyName, decided, upcoming, moreUpcoming: open.length - upcoming.length, requests };
}
