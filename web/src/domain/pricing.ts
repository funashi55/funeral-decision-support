/**
 * デモ用の価格表。東北地方の互助会系葬儀社の施行の記録（2021年以降）にある商品の並びと単価の中央値をもとに、
 * 丸めた値で作った。実在の商品名・会場名は使っていない。
 *  - 祭壇は大きさで3つ（小・中・大）。記録では祭壇の大きさごとのプランに、棺・納棺・枕飾り・写真・霊柩車などの一式を組み合わせていた
 *  - 互助会の会員と一般で価格が違う（一式の品目は一般のほうが2〜5割高い）。祭壇は会員・一般で同じ
 *  - 湯灌・エンバーミング・安置・会場費・料理・香典返しは、プランの外で足す
 * 金額の計算はすべてここで行い、モデルには金額を作らせない。
 */

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
  /** 会員の価格（祭壇＋一式） */
  readonly price: number;
  /** 一般の価格 */
  readonly generalPrice: number;
  /** ドライアイスと安置料がプランに含まれる日数 */
  readonly includedDays: number;
  readonly includes: readonly string[];
  /** プランに含まれず、必要なら追加になるもの（見積もりは「含まれないもの」から示す） */
  readonly excludes: readonly string[];
}

/**
 * どのプランにも入る一式（記録ではほぼすべての施行に入っていた品目）。会員／一般の単価の中央値を丸めた値：
 * お迎え 38,000／42,000・枕飾り 20,000／25,000・納棺処置と仏衣 33,000／43,000・棺 96,000／116,000・
 * 骨箱 9,500／15,000・位牌 15,000／18,000・遺影写真 20,000／27,500・霊柩車 20,000／25,000
 */
const BASE_SET = ["お迎え（搬送）", "枕飾り一式", "納棺処置・仏衣", "棺", "骨箱一式", "位牌", "遺影写真", "霊柩車（10kmまで）", "ドライアイス2日分"];
const BASE_MEMBER = 251_500;
const BASE_GENERAL = 312_000;
const EXCLUDES = ["会場使用料", "安置料（3日目以降）", "ドライアイスの追加", "湯灌", "料理", "香典返し", "お布施"];

/** 祭壇の価格（記録の祭壇の大きさごとの中央値を丸めた値。会員・一般で同じ） */
const ALTAR = { small: 160_000, medium: 385_000, large: 600_000 } as const;

export const ALTAR_PLANS: readonly AltarPlan[] = [
  {
    id: "altar_simple",
    range: "simple",
    label: "生花祭壇（小）",
    price: BASE_MEMBER + ALTAR.small,
    generalPrice: BASE_GENERAL + ALTAR.small,
    includedDays: 2,
    includes: ["生花祭壇（小・幅2間ほど）", ...BASE_SET],
    excludes: EXCLUDES,
  },
  {
    id: "altar_standard",
    range: "standard",
    label: "生花祭壇（中）",
    price: BASE_MEMBER + ALTAR.medium,
    generalPrice: BASE_GENERAL + ALTAR.medium,
    includedDays: 2,
    includes: ["生花祭壇（中・幅3間ほど）", ...BASE_SET],
    excludes: EXCLUDES,
  },
  {
    id: "altar_gratitude",
    range: "gratitude",
    label: "生花祭壇（大）",
    price: BASE_MEMBER + ALTAR.large,
    generalPrice: BASE_GENERAL + ALTAR.large,
    includedDays: 2,
    includes: ["生花祭壇（大・幅4間ほど、故人の好きな花を中心に）", ...BASE_SET],
    excludes: EXCLUDES,
  },
];

export const CATALOG: readonly CatalogItem[] = [
  { id: "yukan", label: "湯灌（お体を洗い清める）", unitPrice: 65_000, unit: "式", returnable: false, covers: "湯灌", note: "納棺の前に行います" },
  { id: "embalming", label: "エンバーミング（防腐・修復の処置）", unitPrice: 160_000, unit: "式", returnable: false, note: "火葬まで日数があく場合に検討します" },
  { id: "dry_ice", label: "ドライアイスの追加", unitPrice: 10_000, unit: "日", returnable: false, covers: "ドライアイスの追加" },
  { id: "resting_fee", label: "会館での安置料（1泊）", unitPrice: 33_000, unit: "日", returnable: false, covers: "安置料" },
  { id: "hall_fee", label: "会場使用料（1日）", unitPrice: 30_000, unit: "式", returnable: false, covers: "会場使用料" },
  { id: "meal", label: "料理（お一人）", unitPrice: 2_500, unit: "名", returnable: false, covers: "料理", note: "人数は前日まで変更できます" },
  { id: "return_gift", label: "香典返し（お一つ）", unitPrice: 2_000, unit: "個", returnable: true, covers: "香典返し", note: "余った分は返品できます" },
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
