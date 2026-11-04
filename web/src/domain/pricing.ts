/**
 * 架空の葬儀社の価格表。実在の価格は使っていない。
 * 金額の計算はすべてここで行い、モデルには金額を作らせない。
 */

export type Range = "simple" | "standard" | "gratitude";

/** プランは価格の上下ではなく、家族の気持ちに合わせた3つの幅で示す */
export const RANGE_LABEL: Record<Range, string> = {
  simple: "費用を抑えたい",
  standard: "しっかり飾りたい",
  gratitude: "感謝の気持ちを表したい",
};

export interface CatalogItem {
  readonly id: string;
  readonly label: string;
  /** 税込の単価（円） */
  readonly unitPrice: number;
  readonly unit: "式" | "日" | "名" | "個";
  /** 後から返品・取り消しができるか */
  readonly returnable: boolean;
  /** この品目を足すと埋まる「含まれないもの」（プランの excludes の先頭一致） */
  readonly covers?: string;
  readonly note?: string;
}

export interface AltarPlan {
  readonly id: string;
  readonly range: Range;
  readonly label: string;
  readonly price: number;
  /** ドライアイスと安置料がプランに含まれる日数 */
  readonly includedDays: number;
  readonly includes: readonly string[];
  /** プランに含まれず、必要なら追加になるもの（見積もりは「含まれないもの」から示す） */
  readonly excludes: readonly string[];
}

export const ALTAR_PLANS: readonly AltarPlan[] = [
  {
    id: "altar_simple",
    range: "simple",
    label: "生花祭壇 こもれび",
    price: 330_000,
    includedDays: 2,
    includes: ["生花祭壇（幅2間）", "遺影写真", "棺（布張り）", "通常の納棺", "ドライアイス2日分", "霊柩車（10kmまで）", "骨箱一式"],
    excludes: ["会場使用料", "安置料（3日目以降）", "ドライアイスの追加", "湯灌", "料理", "香典返し", "お布施"],
  },
  {
    id: "altar_standard",
    range: "standard",
    label: "生花祭壇 せせらぎ",
    price: 520_000,
    includedDays: 3,
    includes: ["生花祭壇（幅3間）", "遺影写真（カラー）", "棺（布張り）", "通常の納棺", "ドライアイス3日分", "霊柩車（10kmまで）", "骨箱一式", "会葬礼状100枚"],
    excludes: ["会場使用料", "安置料（4日目以降）", "ドライアイスの追加", "湯灌", "料理", "香典返し", "お布施"],
  },
  {
    id: "altar_gratitude",
    range: "gratitude",
    label: "生花祭壇 ひだまり",
    price: 780_000,
    includedDays: 3,
    includes: ["生花祭壇（幅4間・故人の好きな花を中心に）", "遺影写真（カラー）", "棺（彫刻）", "通常の納棺", "ドライアイス3日分", "霊柩車（10kmまで）", "骨箱一式", "会葬礼状200枚", "思い出の品の展示台"],
    excludes: ["会場使用料", "安置料（4日目以降）", "ドライアイスの追加", "湯灌", "料理", "香典返し", "お布施"],
  },
];

export const CATALOG: readonly CatalogItem[] = [
  { id: "yukan", label: "湯灌（お体を洗い清める）", unitPrice: 88_000, unit: "式", returnable: false, covers: "湯灌", note: "納棺の前に行います" },
  { id: "embalming", label: "エンバーミング（防腐・修復の処置）", unitPrice: 165_000, unit: "式", returnable: false, note: "火葬まで日数があく場合に検討します" },
  { id: "dry_ice", label: "ドライアイスの追加", unitPrice: 11_000, unit: "日", returnable: false, covers: "ドライアイスの追加" },
  { id: "resting_fee", label: "会館での安置料", unitPrice: 16_500, unit: "日", returnable: false, covers: "安置料" },
  { id: "hall_fee", label: "会場使用料（1日）", unitPrice: 110_000, unit: "式", returnable: false, covers: "会場使用料" },
  { id: "meal", label: "会食（お一人）", unitPrice: 4_400, unit: "名", returnable: false, covers: "料理", note: "人数は前日まで変更できます" },
  { id: "return_gift", label: "香典返し（お一つ）", unitPrice: 3_300, unit: "個", returnable: true, covers: "香典返し", note: "余った分は返品できます" },
];

const PLAN_BY_ID: ReadonlyMap<string, AltarPlan> = new Map(ALTAR_PLANS.map((p) => [p.id, p]));
const ITEM_BY_ID: ReadonlyMap<string, CatalogItem> = new Map(CATALOG.map((c) => [c.id, c]));

export function getPlan(id: string): AltarPlan {
  const plan = PLAN_BY_ID.get(id);
  if (!plan) throw new Error(`未定義のプランです: ${id}`);
  return plan;
}

export function getCatalogItem(id: string): CatalogItem {
  const item = ITEM_BY_ID.get(id);
  if (!item) throw new Error(`未定義の品目です: ${id}`);
  return item;
}

export interface EstimateLine {
  readonly label: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly amount: number;
  readonly returnable: boolean;
}

export interface Estimate {
  readonly planId: string;
  readonly lines: readonly EstimateLine[];
  readonly total: number;
  /** 見積もりに含まれず、別途かかるもの */
  readonly notIncluded: readonly string[];
}

export interface EstimateOption {
  readonly itemId: string;
  readonly quantity: number;
}

/** プランと追加の品目から見積もりを作る。金額は必ずここで計算する */
export function buildEstimate(planId: string, options: readonly EstimateOption[]): Estimate {
  const plan = getPlan(planId);
  const added = options
    .map(({ itemId, quantity }) => {
      if (!Number.isInteger(quantity) || quantity < 0) throw new Error(`数量が不正です: ${itemId}=${quantity}`);
      return { item: getCatalogItem(itemId), quantity };
    })
    .filter(({ quantity }) => quantity > 0);
  const lines: EstimateLine[] = [
    { label: plan.label, quantity: 1, unitPrice: plan.price, amount: plan.price, returnable: false },
    ...added.map(({ item, quantity }) => ({
      label: item.label,
      quantity,
      unitPrice: item.unitPrice,
      amount: item.unitPrice * quantity,
      returnable: item.returnable,
    })),
  ];
  const covered = added.flatMap(({ item }) => (item.covers ? [item.covers] : []));
  const notIncluded = plan.excludes.filter((e) => !covered.some((c) => e.startsWith(c)));
  return { planId, lines, total: lines.reduce((sum, l) => sum + l.amount, 0), notIncluded };
}

/** 円表記（例：330,000円） */
export function yen(amount: number): string {
  return `${amount.toLocaleString("ja-JP")}円`;
}
