/** 1枚ずつ作った発注書の保存場所。案件ごとに、発注の種類ごとの最新の1枚を持つ */
import type { SingleOrderSheet } from "../engine/orderSheet";
import { getKv, type Kv } from "./kv";

export type OrderSheetMap = Readonly<Record<string, SingleOrderSheet>>;

const key = (caseId: string): string => `v1:ordersheets:${caseId}`;

export function createOrderSheetStore(kv: Kv) {
  return {
    all: async (caseId: string): Promise<OrderSheetMap> => (await kv.get<OrderSheetMap>(key(caseId))) ?? {},
    clear: (caseId: string): Promise<void> => kv.set(key(caseId), {}),
    save: async (caseId: string, sheet: SingleOrderSheet): Promise<OrderSheetMap> => {
      const next = { ...((await kv.get<OrderSheetMap>(key(caseId))) ?? {}), [sheet.sheet.orderId]: sheet };
      await kv.set(key(caseId), next);
      return next;
    },
  };
}

export const orderSheetStore = createOrderSheetStore(getKv());
