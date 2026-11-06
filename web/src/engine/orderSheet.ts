/**
 * 発注書を1枚ずつ作る。AI は使わず、確定した決定の値だけで書く（わからない欄は「要確認」）。
 * まとめて作る発注書（paperwork.ts、Claude が書く）と同じ形にして、同じ印刷ページで開けるようにする。
 */
import type { CaseState } from "./case";
import { ORDERS, buildOrders } from "./orders";
import { VENDOR_OF, type OrderSheet, type Paperwork } from "./paperwork";

/** 発注書の頭に書く案件の情報（まとめて作る発注書と共通） */
export type SheetContext = Pick<Paperwork, "familyName" | "createdAt" | "schedule" | "venue" | "deceased">;

export interface SingleOrderSheet {
  readonly sheet: OrderSheet;
  readonly context: SheetContext;
}

const UNKNOWN = "要確認";

const confirmed = (state: CaseState, id: string): string => (state.decisions[id]?.status === "confirmed" ? (state.decisions[id]?.value ?? UNKNOWN) : UNKNOWN);

/** 発注書にできる手配（電話や予約で済むものは除く） */
export const SHEETABLE_ORDERS: ReadonlySet<string> = new Set(ORDERS.filter((o) => o.stage !== "arrange").map((o) => o.id));

export class OrderSheetError extends Error {}

export function buildOrderSheet(state: CaseState, orderId: string, now = Date.now()): SingleOrderSheet {
  if (!SHEETABLE_ORDERS.has(orderId)) throw new OrderSheetError("この手配は発注書にしません（電話や予約で済む手配です）");
  const row = buildOrders(state).find((o) => o.id === orderId);
  if (!row) throw new OrderSheetError("発注の種類が見つかりません");
  if (row.status === "not_needed") throw new OrderSheetError("この手配は今回は要りません");

  // 数は、確定した値に数字があればそれを使い、なければ一式とする
  const counted = row.details.find((d) => /\d/.test(d.value));
  const items = [{ name: row.label, quantity: counted ? counted.value : row.details.length > 0 ? "一式" : UNKNOWN, note: row.details.filter((d) => d !== counted).map((d) => d.value).join("／") }];
  const deliverTo = confirmed(state, "funeral_date") === UNKNOWN ? UNKNOWN : confirmed(state, "funeral_date");
  const deliverAt = UNKNOWN;
  const blanks = [deliverAt, deliverTo, ...items.map((i) => i.quantity)].filter((v) => v === UNKNOWN).length;

  return {
    sheet: {
      orderId,
      label: row.label,
      vendor: VENDOR_OF[orderId] ?? row.label,
      status: row.status,
      waitingFor: row.waitingFor,
      items,
      deliverAt,
      deliverTo,
      notes: "",
      extras: [],
      utteranceIds: [],
      blanks,
    },
    context: {
      familyName: state.familyName,
      createdAt: now,
      schedule: {
        death: UNKNOWN,
        layingIn: confirmed(state, "laying_in_date"),
        departure: UNKNOWN,
        cremation: confirmed(state, "cremation_date"),
        wake: confirmed(state, "wake_date"),
        funeral: confirmed(state, "funeral_date"),
        burial: UNKNOWN,
        meal: UNKNOWN,
      },
      venue: deliverTo,
      deceased: { age: state.profile.deceasedAge ? `${state.profile.deceasedAge}歳` : UNKNOWN, sex: UNKNOWN },
    },
  };
}
