/**
 * 価格表。品目と単価は data/product-catalog.json（施行の記録の商品別売上から作った集計値）から読む。
 * 集計は scripts/build_product_catalog.py で行い、品目ごとの中央値と件数だけを置いている（実在の商品名・会場名は持たない）。
 *  - 祭壇は大きさで3つ（小・中・大）。記録の祭壇の単価の下位25%・中央値・上位25%
 *  - どのプランにも、記録でほぼすべての施行に入っていた一式（お迎え・枕飾り・納棺処置・仏衣・棺・骨箱・位牌・遺影写真・霊柩車）を含める
 *  - 互助会の会員と一般で価格が違う品目は、それぞれの中央値を使う
 * 金額の計算はすべてここで行い、モデルには金額を作らせない。
 */
import catalogData from "../data/product-catalog.json";

export type Range = "simple" | "standard" | "gratitude";

/** プランは価格の上下ではなく、家族の気持ちに合わせた3つの幅で示す */
export const RANGE_LABEL: Record<Range, string> = {
  simple: "費用を抑えたい",
  standard: "しっかり飾りたい",
  gratitude: "感謝の気持ちを表したい",
};

/** 会員（互助会の積立あり）か一般か */
export type PriceTier = "member" | "general";
export const TIER_LABEL: Record<PriceTier, string> = { member: "会員価格", general: "一般価格" };

export interface CatalogItem {
  readonly id: string;
  readonly label: string;
  /** 税込の単価（円・会員） */
  readonly unitPrice: number;
  /** 一般の単価。会員と同じなら省く */
  readonly generalPrice?: number;
  readonly unit: "式" | "日" | "名" | "個" | "台";
  /** 後から返品・取り消しができるか */
  readonly returnable: boolean;
  /** この品目を足すと埋まる「含まれないもの」（プランの excludes の先頭一致） */
  readonly covers?: string;
  readonly note?: string;
  /** 単価のもとにした記録の件数 */
  readonly count?: number;
}

export interface AltarPlan {
  readonly id: string;
  readonly range: Range;
  readonly label: string;
  /** 会員の価格（祭壇＋一式） */
  readonly price: number;
  /** 一般の価格 */
  readonly generalPrice: number;
  /** ドライアイスがプランに含まれる日数 */
  readonly includedDays: number;
  readonly includes: readonly string[];
  /** プランに含まれず、必要なら追加になるもの（見積もりは「含まれないもの」から示す） */
  readonly excludes: readonly string[];
}

interface CatalogRow {
  readonly id: string;
  readonly label: string;
  readonly unit: string;
  readonly memberPrice: number;
  readonly generalPrice: number;
  readonly count: number;
}

/** 集計にない、品目ごとの扱い（返品できるか・どの「含まれないもの」を埋めるか・説明） */
const ITEM_META: Readonly<Record<string, Pick<CatalogItem, "returnable" | "covers" | "note">>> = {
  yukan: { returnable: false, covers: "湯灌", note: "納棺の前に行います" },
  embalming: { returnable: false, note: "火葬まで日数があく場合に検討します" },
  dry_ice: { returnable: false, covers: "ドライアイスの追加" },
  resting_fee: { returnable: false, covers: "安置料" },
  hall_fee: { returnable: false, covers: "会場使用料" },
  meal: { returnable: false, covers: "料理", note: "人数は前日まで変更できます" },
  return_gift: { returnable: true, covers: "香典返し", note: "余った分は返品できます" },
  obituary: { returnable: false, covers: "お悔やみ欄", note: "掲載すると取り消せません" },
  crematory_car: { returnable: false, covers: "火葬場への送迎車" },
  coffin_bouquet: { returnable: false, covers: "棺上花束" },
};

const ROWS = (catalogData as { readonly items: readonly CatalogRow[] }).items;

export const CATALOG: readonly CatalogItem[] = ROWS.map((r) => ({
  id: r.id,
  label: r.label,
  unitPrice: r.memberPrice,
  ...(r.generalPrice !== r.memberPrice ? { generalPrice: r.generalPrice } : {}),
  unit: r.unit as CatalogItem["unit"],
  count: r.count,
  returnable: ITEM_META[r.id]?.returnable ?? false,
  ...(ITEM_META[r.id]?.covers ? { covers: ITEM_META[r.id]?.covers } : {}),
  ...(ITEM_META[r.id]?.note ? { note: ITEM_META[r.id]?.note } : {}),
}));

/** 価格表の出どころ（画面の注記に使う） */
export const CATALOG_SOURCE = `${catalogData.source}・${catalogData.period}の中央値（丸めた値）`;

/** どのプランにも入る一式（記録でほぼすべての施行に入っていた品目） */
const BASE_SET_IDS = ["pickup", "pillow_set", "laying_care", "robe", "coffin", "urn", "tablet", "portrait", "hearse"] as const;
const INCLUDED_ICE_DAYS = 2;
const EXCLUDES = ["会場使用料", "安置料", "ドライアイスの追加", "湯灌", "料理", "香典返し", "お悔やみ欄", "火葬場への送迎車", "棺上花束", "お布施"];

const item = (id: string): CatalogRow => {
  const row = ROWS.find((r) => r.id === id);
  if (!row) throw new Error(`価格表に品目がありません: ${id}`);
  return row;
};
const baseTotal = (tier: PriceTier): number =>
  BASE_SET_IDS.reduce((sum, id) => sum + (tier === "member" ? item(id).memberPrice : item(id).generalPrice), 0) +
  INCLUDED_ICE_DAYS * (tier === "member" ? item("dry_ice").memberPrice : item("dry_ice").generalPrice);
const BASE_INCLUDES = [...BASE_SET_IDS.map((id) => item(id).label), `ドライアイス${INCLUDED_ICE_DAYS}日分`];

const ALTAR_SIZE: Readonly<Record<Range, { readonly price: number; readonly label: string; readonly altar: string }>> = {
  simple: { price: catalogData.altar.small, label: "生花祭壇（小）", altar: "生花祭壇（小・幅2間ほど）" },
  standard: { price: catalogData.altar.medium, label: "生花祭壇（中）", altar: "生花祭壇（中・幅3間ほど）" },
  gratitude: { price: catalogData.altar.large, label: "生花祭壇（大）", altar: "生花祭壇（大・幅4間ほど、故人の好きな花を中心に）" },
};

export const ALTAR_PLANS: readonly AltarPlan[] = (["simple", "standard", "gratitude"] as const).map((range) => ({
  id: `altar_${range}`,
  range,
  label: ALTAR_SIZE[range].label,
  price: ALTAR_SIZE[range].price + baseTotal("member"),
  generalPrice: ALTAR_SIZE[range].price + baseTotal("general"),
  includedDays: INCLUDED_ICE_DAYS,
  includes: [ALTAR_SIZE[range].altar, ...BASE_INCLUDES],
  excludes: EXCLUDES,
}));

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
  readonly tier: PriceTier;
  readonly lines: readonly EstimateLine[];
  readonly total: number;
  /** 見積もりに含まれず、別途かかるもの */
  readonly notIncluded: readonly string[];
}

export interface EstimateOption {
  readonly itemId: string;
  readonly quantity: number;
}

/** プランと追加の品目から見積もりを作る。金額は必ずここで計算する。会員か一般かで一式の価格が変わる */
export function buildEstimate(planId: string, options: readonly EstimateOption[], tier: PriceTier = "member"): Estimate {
  const plan = getPlan(planId);
  const planPrice = tier === "general" ? plan.generalPrice : plan.price;
  const unit = (item: CatalogItem): number => (tier === "general" ? (item.generalPrice ?? item.unitPrice) : item.unitPrice);
  const added = options
    .map(({ itemId, quantity }) => {
      if (!Number.isInteger(quantity) || quantity < 0) throw new Error(`数量が不正です: ${itemId}=${quantity}`);
      return { item: getCatalogItem(itemId), quantity };
    })
    .filter(({ quantity }) => quantity > 0);
  const lines: EstimateLine[] = [
    { label: `${plan.label}（${TIER_LABEL[tier]}）`, quantity: 1, unitPrice: planPrice, amount: planPrice, returnable: false },
    ...added.map(({ item, quantity }) => ({
      label: item.label,
      quantity,
      unitPrice: unit(item),
      amount: unit(item) * quantity,
      returnable: item.returnable,
    })),
  ];
  const covered = added.flatMap(({ item }) => (item.covers ? [item.covers] : []));
  const notIncluded = plan.excludes.filter((e) => !covered.some((c) => e.startsWith(c)));
  return { planId, tier, lines, total: lines.reduce((sum, l) => sum + l.amount, 0), notIncluded };
}

/** 円表記（例：330,000円） */
export function yen(amount: number): string {
  return `${amount.toLocaleString("ja-JP")}円`;
}
