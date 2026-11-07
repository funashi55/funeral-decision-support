/**
 * 受注書（施行ごとの親の表）。AI は使わず、確定した決定と登録の内容から決まった規則で作る。
 * 作るたびに中身が変わらないように、プランの定番の一式・祭壇・発注するものを同じ順で並べる。金額は書かない
 */
import type { CaseState } from "./case";
import { ORDERS, buildOrders } from "./orders";
import { SHEETABLE_ORDERS, buildOrderSheet, caseContext } from "./orderSheet";
import { IN_HOUSE, LEDGER_CATEGORIES, VENDOR_OF, withStandardRows, type LedgerRow, type Paperwork } from "./paperwork";

type Category = (typeof LEDGER_CATEGORIES)[number];

/** 発注の種類ごとの、受注書の区分 */
const CATEGORY_OF: Readonly<Record<string, Category>> = {
  pillow_set: "枕飾り",
  flowers: "祭壇・生花",
  farewell_flowers: "祭壇・生花",
  sweets: "菓子・果物",
  fruit: "菓子・果物",
  return_gifts: "返礼品・礼状",
  takeaway_set: "返礼品・礼状",
  thank_you_card: "返礼品・礼状",
  last_letter: "返礼品・礼状",
  meals: "飲食",
  emcee: "人の手配",
  parking: "人の手配",
  obituary: "その他",
  taxi: "車両",
  yukan: "納棺",
  embalming: "納棺",
};

export interface Juchu {
  readonly familyName: string;
  readonly createdAt: number;
  readonly staffName?: string;
  /** 故人の名前（登録で伺ったとき）。なければ空にして手で書く */
  readonly deceased: { readonly name: string; readonly age: string; readonly sex: string };
  /** 喪主の続柄 */
  readonly mourner: string;
  readonly venue: string;
  readonly restingPlace: string;
  readonly schedule: Paperwork["schedule"];
  readonly ledger: readonly LedgerRow[];
}

const UNKNOWN = "要確認";

const confirmed = (state: CaseState, id: string): string | undefined =>
  state.decisions[id]?.status === "confirmed" ? state.decisions[id]?.value : undefined;

function orderRows(state: CaseState): LedgerRow[] {
  const status = new Map(buildOrders(state).map((o) => [o.id, o]));
  return ORDERS.filter((o) => SHEETABLE_ORDERS.has(o.id)).flatMap((o): LedgerRow[] => {
    const row = status.get(o.id);
    if (!row || row.status === "not_needed") return [];
    const sheet = buildOrderSheet(state, o.id).sheet;
    const item = sheet.items[0];
    const note = sheet.extras.map((e) => `${e.label}：${e.value}`).join("／");
    return [{ category: CATEGORY_OF[o.id] ?? "その他", name: item?.name ?? row.label, quantity: item?.quantity ?? UNKNOWN, note, orderId: o.id, vendor: VENDOR_OF[o.id] ?? row.label, status: row.status }];
  });
}

export function buildJuchu(state: CaseState, now = Date.now()): Juchu {
  const ctx = caseContext(state, now);
  const reg = state.registration;
  const altar = confirmed(state, "altar_plan");
  const altarRow: LedgerRow[] = altar ? [{ category: "祭壇・生花", name: `祭壇（${altar}）`, quantity: "一式", note: confirmed(state, "flower_color") ?? "", orderId: null, vendor: IN_HOUSE, status: null }] : [];
  const resting = confirmed(state, "resting_place") ?? (reg?.restingPlace && reg.restingPlace !== "未定" ? reg.restingPlace : undefined);
  return {
    familyName: ctx.familyName,
    createdAt: ctx.createdAt,
    ...(ctx.staffName ? { staffName: ctx.staffName } : {}),
    deceased: { name: reg?.deceased.name ?? "", age: ctx.deceased.age, sex: ctx.deceased.sex },
    mourner: confirmed(state, "chief_mourner") ?? reg?.chiefMourner.relation ?? UNKNOWN,
    venue: ctx.venue,
    restingPlace: resting ?? UNKNOWN,
    schedule: ctx.schedule,
    ledger: withStandardRows([...altarRow, ...orderRows(state)]),
  };
}
