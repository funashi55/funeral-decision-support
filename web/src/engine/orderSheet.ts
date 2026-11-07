/**
 * 発注書を1枚ずつ作る。AI は使わず、確定した決定と登録の内容だけで書く（わからない欄は「要確認」）。
 * 品物ごとに、数量・届け日時・届け先・業者ごとの確認欄を決めた規則で埋める。金額は書かない（見積書で確かめる）。
 * まとめて作る発注書（paperwork.ts、Claude が書く）と同じ形にして、同じ印刷ページで開けるようにする。
 */
import type { CaseState } from "./case";
import { ORDERS, buildOrders } from "./orders";
import { VENDOR_OF, type OrderSheet, type Paperwork } from "./paperwork";
import { readCount } from "./plans";

/** 発注書の頭に書く案件の情報（まとめて作る発注書と共通） */
export type SheetContext = Pick<Paperwork, "familyName" | "createdAt" | "schedule" | "venue" | "deceased">;

export interface SingleOrderSheet {
  readonly sheet: OrderSheet;
  /** staffName：この喪家の担当者（登録で入れた名前） */
  readonly context: SheetContext & { readonly staffName?: string };
}

const UNKNOWN = "要確認";
/** タクシー1台に乗る人数の目安 */
const TAXI_SEATS = 4;

/** 発注書にできる手配（電話や予約で済むものは除く） */
export const SHEETABLE_ORDERS: ReadonlySet<string> = new Set(ORDERS.filter((o) => o.stage !== "arrange").map((o) => o.id));

export class OrderSheetError extends Error {}

const confirmedValue = (state: CaseState, id: string): string | undefined =>
  state.decisions[id]?.status === "confirmed" ? state.decisions[id]?.value : undefined;

/** 「11月10日 18時 東斎場」から日付を取り出す */
export function dateOf(value: string | undefined): string | undefined {
  return value?.match(/\d{1,2}月\d{1,2}日/)?.[0];
}

/** 「11月10日 18時 東斎場」から会場を取り出す（日付・時刻のあとの言葉） */
export function venueOf(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const rest = value
    .replace(/\d{1,2}月\d{1,2}日(?:（.）)?/g, "")
    .replace(/(?:午前|午後)?\s*\d{1,2}\s*(?:時|:)\s*(?:\d{1,2}分?|半)?/g, "")
    .replace(/[、,\s]+/g, " ")
    .trim();
  return rest || undefined;
}

/** 数字を読む（「30個」→ 30） */
const numberIn = (value: string | undefined): number | null => {
  const m = value?.match(/\d+/);
  return m ? Number(m[0]) : null;
};

/** 亡くなった日時（登録の 2026-11-07T05:30）を「11月7日 5時30分」にする */
function deathText(diedAt: string | undefined): string | undefined {
  const m = diedAt?.match(/^\d{4}-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!m) return diedAt || undefined;
  const [, mo, d, h, mi] = m;
  return `${Number(mo)}月${Number(d)}日${h ? ` ${Number(h)}時${mi && mi !== "00" ? `${Number(mi)}分` : ""}` : ""}`;
}

interface Facts {
  readonly wake?: string;
  readonly funeral?: string;
  readonly cremation?: string;
  readonly layingIn?: string;
  readonly hasWake: boolean;
  readonly venue?: string;
  readonly people: number | null;
}

function factsOf(state: CaseState): Facts {
  const v = (id: string) => confirmedValue(state, id);
  const hasWake = !/なし|不要|しない|行わない/.test(v("wake_held") ?? "") && state.profile.funeralStyle !== "一日葬" && state.profile.funeralStyle !== "火葬式";
  const resting = state.registration?.restingPlace;
  return {
    wake: hasWake ? v("wake_date") : undefined,
    funeral: v("funeral_date"),
    cremation: v("cremation_date"),
    layingIn: v("laying_in_date"),
    hasWake,
    venue: venueOf(v("funeral_date")) ?? venueOf(v("wake_date")) ?? (resting === "会館" ? "当社会館" : resting === "自宅" ? "ご自宅" : undefined),
    people: readCount(v("attendees_scope")) ?? readCount(v("meals")),
  };
}

/** 式の前に飾る品の届け日時：通夜があれば通夜の日、なければ葬儀の日 */
function beforeCeremony(f: Facts, when: string): string {
  const day = dateOf(f.wake) ?? dateOf(f.funeral);
  return day ? `${day} ${when}` : UNKNOWN;
}

interface Spec {
  readonly name?: (state: CaseState) => string;
  readonly quantity: (state: CaseState, f: Facts) => string;
  readonly deliverAt: (state: CaseState, f: Facts) => string;
  readonly deliverTo?: (state: CaseState, f: Facts) => string | undefined;
  readonly extras?: (state: CaseState, f: Facts) => readonly { readonly label: string; readonly value: string }[];
}

const v = confirmedValue;
const orUnknown = (x: string | undefined): string => x ?? UNKNOWN;
const ONE = () => "一式";

const SPECS: Readonly<Record<string, Spec>> = {
  pillow_set: {
    quantity: ONE,
    deliverAt: () => "ご安置のあと、すぐ",
    deliverTo: (s) => (s.registration?.restingPlace === "自宅" ? "ご自宅" : s.registration?.restingPlace === "会館" ? "当社会館（安置室）" : undefined),
  },
  flowers: {
    name: (s) => `${orUnknown(v(s, "altar_plan"))}の祭壇花`,
    quantity: ONE,
    deliverAt: (_, f) => beforeCeremony(f, f.hasWake ? "通夜の3時間前までに飾り付け" : "開式の3時間前までに飾り付け"),
    extras: (s) => [
      { label: "色合い", value: orUnknown(v(s, "flower_color")) },
      { label: "故人の好み", value: v(s, "deceased_character") ?? "特になし" },
    ],
  },
  sweets: { quantity: ONE, deliverAt: (_, f) => beforeCeremony(f, "午前中"), extras: (s) => [{ label: "祭壇", value: orUnknown(v(s, "altar_plan")) }] },
  fruit: { quantity: ONE, deliverAt: (_, f) => beforeCeremony(f, "午前中"), extras: (s) => [{ label: "祭壇", value: orUnknown(v(s, "altar_plan")) }] },
  farewell_flowers: {
    quantity: ONE,
    deliverAt: (_, f) => (dateOf(f.funeral) ? `${dateOf(f.funeral)} 出棺の1時間前まで` : UNKNOWN),
    extras: (s) => [{ label: "色合い", value: orUnknown(v(s, "flower_color")) }],
  },
  return_gifts: {
    quantity: (s) => orUnknown(v(s, "return_gifts")),
    deliverAt: (_, f) => beforeCeremony(f, "正午まで"),
    extras: (s) => [
      { label: "余りの返品", value: "未開封の余りを返品できるか、品物ごとに確かめて返信ください" },
      { label: "香典の扱い", value: v(s, "koden_decline") ?? "いただく（辞退の場合は数を見直す）" },
    ],
  },
  takeaway_set: {
    quantity: (_, f) => (f.people ? `${f.people}個` : UNKNOWN),
    extras: (s) => [{ label: "参列の目安", value: orUnknown(v(s, "attendees_scope")) }],
    deliverAt: (_, f) => (dateOf(f.wake) ? `${dateOf(f.wake)} 通夜の1時間前まで` : UNKNOWN),
  },
  thank_you_card: {
    quantity: (s, f) => {
      const n = numberIn(v(s, "thank_you_card")) ?? f.people;
      return n ? `${n}枚` : UNKNOWN;
    },
    deliverAt: (_, f) => beforeCeremony(f, "正午まで"),
    extras: (s) => [{ label: "文面", value: orUnknown(v(s, "thank_you_card")) }, { label: "差出人", value: `喪主　${orUnknown(v(s, "chief_mourner"))}` }],
  },
  last_letter: { quantity: ONE, deliverAt: (_, f) => beforeCeremony(f, "正午まで"), extras: (s) => [{ label: "内容", value: orUnknown(v(s, "thank_you_card")) }] },
  meals: {
    quantity: (s) => {
      const n = readCount(v(s, "meals")) ?? numberIn(v(s, "meals"));
      return n ? `${n}名分` : UNKNOWN;
    },
    deliverAt: (_, f) => (dateOf(f.cremation) ? `${dateOf(f.cremation)} 火葬の待ち時間に合わせて` : UNKNOWN),
    deliverTo: (_, f) => venueOf(f.cremation) ?? f.venue,
  },
  emcee: { quantity: ONE, deliverAt: (_, f) => (f.funeral ? `${f.funeral}（開式の1時間前に入り）` : UNKNOWN) },
  parking: { quantity: ONE, deliverAt: (_, f) => (f.funeral ? `${f.funeral}（開式の1時間前から）` : UNKNOWN) },
  obituary: {
    quantity: ONE,
    deliverAt: () => "掲載日はご家族と相談のうえ連絡",
    deliverTo: () => "新聞社の受付窓口",
    extras: (s) => [
      { label: "載せる内容", value: orUnknown(v(s, "obituary")) },
      { label: "香典の扱い", value: v(s, "koden_decline") ?? UNKNOWN },
    ],
  },
  taxi: {
    quantity: (s) => {
      const n = readCount(v(s, "crematorium_party")) ?? numberIn(v(s, "crematorium_party"));
      return n ? `${Math.ceil(n / TAXI_SEATS)}台` : UNKNOWN;
    },
    deliverAt: (_, f) => (f.cremation ? `${dateOf(f.cremation) ?? ""} 出棺に合わせて`.trim() : UNKNOWN),
    extras: (s, f) => [{ label: "経路", value: `${f.venue ?? UNKNOWN} → ${venueOf(f.cremation) ?? UNKNOWN}（往復）` }, { label: "人数", value: orUnknown(v(s, "crematorium_party")) }],
  },
  yukan: { quantity: ONE, deliverAt: (_, f) => orUnknown(f.layingIn), extras: (s) => [{ label: "納棺の形", value: orUnknown(v(s, "laying_in_style")) }] },
  embalming: { quantity: ONE, deliverAt: (_, f) => (f.layingIn ? `${f.layingIn}より前` : UNKNOWN), extras: (s) => [{ label: "ご希望", value: orUnknown(v(s, "embalming")) }] },
};

const countBlanks = (values: readonly string[]): number => values.filter((x) => x.includes(UNKNOWN)).length;

export function buildOrderSheet(state: CaseState, orderId: string, now = Date.now()): SingleOrderSheet {
  if (!SHEETABLE_ORDERS.has(orderId)) throw new OrderSheetError("この手配は発注書にしません（電話や予約で済む手配です）");
  const row = buildOrders(state).find((o) => o.id === orderId);
  if (!row) throw new OrderSheetError("発注の種類が見つかりません");
  if (row.status === "not_needed") throw new OrderSheetError("この手配は今回は要りません");

  const f = factsOf(state);
  const spec = SPECS[orderId];
  const name = spec?.name?.(state) ?? row.label;
  const quantity = spec ? spec.quantity(state, f) : row.details.length > 0 ? "一式" : UNKNOWN;
  // 決まりのある品物は、必要なことを数量・届け日時・確認欄に書くので、備考には重ねない
  const note = spec ? "" : row.details.map((d) => d.value).join("／");
  const items = [{ name, quantity, note }];
  const deliverAt = spec?.deliverAt(state, f) ?? UNKNOWN;
  const deliverTo = spec?.deliverTo?.(state, f) ?? f.venue ?? UNKNOWN;
  const extras = spec?.extras?.(state, f) ?? [];
  const blanks = countBlanks([deliverAt, deliverTo, quantity, name, ...extras.map((e) => e.value)]);

  return {
    sheet: { orderId, label: row.label, vendor: VENDOR_OF[orderId] ?? row.label, status: row.status, waitingFor: row.waitingFor, items, deliverAt, deliverTo, notes: "", extras, utteranceIds: [], blanks },
    context: caseContext(state, now),
  };
}

/** 発注書・受注書の頭に書く案件の情報（日程・式場・故人・担当者）。確定した決定と登録から作る */
export function caseContext(state: CaseState, now = Date.now()): SingleOrderSheet["context"] {
  const f = factsOf(state);
  const reg = state.registration;
  const age = state.profile.deceasedAge ?? reg?.deceased.age;
  return {
    familyName: state.familyName,
    createdAt: now,
    schedule: {
      death: orUnknown(deathText(reg?.deceased.diedAt)),
      layingIn: orUnknown(f.layingIn),
      departure: dateOf(f.funeral) ? `${dateOf(f.funeral)}（葬儀のあと）` : UNKNOWN,
      cremation: orUnknown(f.cremation),
      wake: f.hasWake ? orUnknown(f.wake) : "行わない",
      funeral: orUnknown(f.funeral),
      burial: orUnknown(v(state, "burial_place")),
      meal: v(state, "meals") ?? UNKNOWN,
    },
    venue: f.venue ?? UNKNOWN,
    deceased: { age: age !== undefined ? `${age}歳` : UNKNOWN, sex: reg?.deceased.sex && reg.deceased.sex !== "答えない" ? reg.deceased.sex : UNKNOWN },
    ...(reg?.staffName ? { staffName: reg.staffName } : {}),
  };
}
