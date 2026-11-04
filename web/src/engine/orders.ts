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

export interface OrderDefinition {
  readonly id: string;
  readonly label: string;
  /** 発注の前に確定している必要がある決定 */
  readonly needs: readonly string[];
  /** 確定した値がこれに当たるときは発注しない（例：通常の納棺なら湯灌の手配は要らない） */
  readonly skipIf?: { readonly decisionId: string; readonly pattern: RegExp };
}

const DECLINED = /なし|不要|しない|行わない|載せない/;

/** 発注・手配の18項目 */
export const ORDERS: readonly OrderDefinition[] = [
  { id: "crematorium", label: "火葬場の予約", needs: ["cremation_date"] },
  { id: "hearse", label: "霊柩車の手配", needs: ["cremation_date"] },
  { id: "temple_contact", label: "寺院への連絡", needs: ["temple"] },
  { id: "resting", label: "安置室の確保", needs: ["resting_place"] },
  { id: "dry_ice", label: "ドライアイスの手配", needs: ["resting_place", "cremation_date"] },
  { id: "yukan", label: "湯灌の手配", needs: ["laying_in_style", "laying_in_date"], skipIf: { decisionId: "laying_in_style", pattern: /^(?!.*湯灌)/ } },
  { id: "embalming", label: "エンバーミングの手配", needs: ["embalming"], skipIf: { decisionId: "embalming", pattern: DECLINED } },
  { id: "coffin", label: "棺の手配", needs: ["coffin"] },
  { id: "altar", label: "祭壇の設営", needs: ["altar_plan", "funeral_date"] },
  { id: "flowers", label: "生花の発注", needs: ["altar_plan", "flower_color"] },
  { id: "photo", label: "遺影写真の作成", needs: ["photo"] },
  { id: "thank_you_card", label: "会葬礼状の印刷", needs: ["thank_you_card"] },
  { id: "meals", label: "料理の発注", needs: ["meals"], skipIf: { decisionId: "meals", pattern: DECLINED } },
  { id: "return_gifts", label: "香典返しの発注", needs: ["return_gifts"] },
  { id: "obituary", label: "お悔やみ欄の掲載の申し込み", needs: ["obituary"], skipIf: { decisionId: "obituary", pattern: DECLINED } },
  { id: "emcee", label: "司会の手配", needs: ["emcee"], skipIf: { decisionId: "emcee", pattern: DECLINED } },
  { id: "reception", label: "受付の手配", needs: ["reception_desk"] },
  { id: "parking", label: "駐車場係の手配", needs: ["parking"], skipIf: { decisionId: "parking", pattern: DECLINED } },
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
