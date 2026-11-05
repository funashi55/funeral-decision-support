/**
 * 確定した決定から作る、確認表と発注リスト、基幹システム向けの CSV。
 * 候補（AI が拾っただけのもの）は発注に回さない。確定したものだけを「手配できる」とする。
 */
import { DECISIONS, PHASE_LABEL, getDecision, type Phase } from "../domain/decisions";
import type { CaseState } from "./case";

export type ChecklistStatus = "confirmed" | "candidate" | "open";

export interface ChecklistRow {
  readonly decisionId: string;
  readonly label: string;
  readonly phase: Phase;
  readonly phaseLabel: string;
  readonly status: ChecklistStatus;
  readonly value: string | null;
  /** 今日決める必要があり、まだ確定していない */
  readonly dueToday: boolean;
}

export function buildChecklist(state: CaseState): ChecklistRow[] {
  return DECISIONS.map((d) => {
    const s = state.decisions[d.id];
    const status: ChecklistStatus = s?.status === "confirmed" ? "confirmed" : s ? "candidate" : "open";
    return {
      decisionId: d.id,
      label: d.label,
      phase: d.phase,
      phaseLabel: PHASE_LABEL[d.phase],
      status,
      value: s?.value ?? null,
      dueToday: d.urgency === "today" && status !== "confirmed",
    };
  });
}

/**
 * 手配の段取り
 *  before：打合せの前に済ませる（枕飾りなど）
 *  order：業者に発注書（FAX）で頼む
 *  arrange：電話・予約・社内の段取りで済む（発注書にせず、担当者の TODO にする）
 */
export type OrderStage = "before" | "order" | "arrange";

export interface OrderDefinition {
  readonly id: string;
  readonly label: string;
  readonly stage: OrderStage;
  /** 発注の前に確定している必要がある決定 */
  readonly needs: readonly string[];
  /** 確定した値がこれに当たるときは発注しない（例：通常の納棺なら湯灌の手配は要らない） */
  readonly skipIf?: { readonly decisionId: string; readonly pattern: RegExp };
}

const DECLINED = /なし|不要|しない|行わない|載せない/;

/**
 * 発注・手配の項目。東北地方の互助会系葬儀社の施行管理テンプレート（打合せ前・発注）の項目に合わせた。
 * 社内で用意するもの（棺・祭壇・遺影写真・霊柩車など）は、プランに含まれるので発注には入れない
 */
export const ORDERS: readonly OrderDefinition[] = [
  // 打合せの前に
  { id: "pillow_set", label: "枕花・枕果物・枕菓子", stage: "before", needs: [] },
  { id: "crematorium", label: "火葬場の空き確認と予約", stage: "arrange", needs: ["cremation_date"] },
  // 電話・予約・社内の段取り
  { id: "temple_contact", label: "寺院への連絡", stage: "arrange", needs: ["temple"] },
  { id: "death_certificate", label: "市役所への死亡届の提出", stage: "arrange", needs: ["death_certificate"] },
  { id: "crematorium_staff", label: "火葬係への連絡", stage: "arrange", needs: ["cremation_date"] },
  { id: "venue_shop", label: "斎場の売店への連絡", stage: "arrange", needs: ["cremation_date"] },
  { id: "offering_dismantle", label: "供物解体の依頼", stage: "arrange", needs: ["funeral_date"] },
  // 業者への発注
  { id: "flowers", label: "祭壇花", stage: "order", needs: ["altar_plan", "flower_color"] },
  { id: "sweets", label: "式用のお菓子", stage: "order", needs: ["altar_plan"] },
  { id: "fruit", label: "祭壇用の果物", stage: "order", needs: ["altar_plan"] },
  { id: "farewell_flowers", label: "出棺花", stage: "order", needs: ["funeral_date"] },
  { id: "return_gifts", label: "香典返し", stage: "order", needs: ["return_gifts"] },
  { id: "takeaway_set", label: "通夜の持ち帰りセット", stage: "order", needs: ["wake_held", "attendees_scope"], skipIf: { decisionId: "wake_held", pattern: DECLINED } },
  { id: "thank_you_card", label: "会葬礼状", stage: "order", needs: ["thank_you_card"] },
  { id: "last_letter", label: "ラストレター", stage: "order", needs: ["thank_you_card"], skipIf: { decisionId: "thank_you_card", pattern: /^(?!.*ラストレター)/ } },
  { id: "meals", label: "弁当・料理", stage: "order", needs: ["meals"], skipIf: { decisionId: "meals", pattern: DECLINED } },
  { id: "emcee", label: "司会", stage: "order", needs: ["emcee"], skipIf: { decisionId: "emcee", pattern: DECLINED } },
  { id: "parking", label: "駐車場の交通誘導員", stage: "order", needs: ["parking"], skipIf: { decisionId: "parking", pattern: DECLINED } },
  { id: "obituary", label: "新聞広告（お悔やみ欄）", stage: "order", needs: ["obituary"], skipIf: { decisionId: "obituary", pattern: DECLINED } },
  { id: "taxi", label: "タクシー", stage: "order", needs: ["crematorium_party"] },
  { id: "yukan", label: "湯灌の依頼", stage: "order", needs: ["laying_in_style", "laying_in_date"], skipIf: { decisionId: "laying_in_style", pattern: /^(?!.*湯灌)/ } },
  { id: "embalming", label: "エンバーミングの依頼", stage: "order", needs: ["embalming"], skipIf: { decisionId: "embalming", pattern: DECLINED } },
];

export type OrderStatus = "ready" | "waiting" | "not_needed";

export interface OrderRow {
  readonly id: string;
  readonly label: string;
  readonly status: OrderStatus;
  /** 確定した決定の値（発注書に書く内容） */
  readonly details: readonly { readonly label: string; readonly value: string }[];
  /** まだ確定していない前提の決定 */
  readonly waitingFor: readonly string[];
}

const confirmedValue = (state: CaseState, id: string): string | null =>
  state.decisions[id]?.status === "confirmed" ? (state.decisions[id]?.value ?? null) : null;

export function buildOrders(state: CaseState): OrderRow[] {
  return ORDERS.map((o) => {
    const details = o.needs.flatMap((id) => {
      const v = confirmedValue(state, id);
      return v === null ? [] : [{ label: getDecision(id).label, value: v }];
    });
    const skipValue = o.skipIf ? confirmedValue(state, o.skipIf.decisionId) : null;
    if (o.skipIf && skipValue !== null && o.skipIf.pattern.test(skipValue)) {
      return { id: o.id, label: o.label, status: "not_needed", details, waitingFor: [] };
    }
    const waitingFor = o.needs.filter((id) => confirmedValue(state, id) === null).map((id) => getDecision(id).label);
    return { id: o.id, label: o.label, status: waitingFor.length === 0 ? "ready" : "waiting", details, waitingFor };
  });
}

/** CSV の1マス。カンマ・改行・引用符を含むときは引用符で囲む。表計算ソフトの数式として解釈されないよう先頭を守る */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** 基幹システムの施行情報の項目名で、確定した決定だけを書き出す（Excel で開けるよう BOM 付き） */
export function toCoreCsv(state: CaseState): string {
  const fields = DECISIONS.filter((d) => d.coreField);
  const header = ["家名", ...fields.map((d) => d.coreField ?? d.id)];
  const row = [state.familyName, ...fields.map((d) => confirmedValue(state, d.id) ?? "")];
  return `﻿${[header, row].map((r) => r.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
