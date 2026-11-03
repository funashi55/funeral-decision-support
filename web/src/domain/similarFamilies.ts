/**
 * 似た家族の選び方（家業の基幹システムの匿名集計）を引く。
 * 数字はモデルに作らせず、必ずこの集計表から取る。参考として示すもので、多数派に合わせるよう促さない。
 */
import data from "../data/similar-families.json";

export interface FamilyProfile {
  /** 受付から葬儀までの見込み日数 */
  readonly daysUntilFuneral?: number;
  readonly deceasedAge?: number;
  readonly funeralStyle?: "家族葬" | "一般葬" | "一日葬" | "火葬式";
  readonly membership?: "互助会の会員" | "会員ではない" | "メンバーズ会員";
}

export interface Reference {
  /** 例：「火葬まで6日以上あく家族」 */
  readonly cohort: string;
  /** 例：「湯灌を選んだ割合」 */
  readonly measure: string;
  readonly percent: number;
  readonly count: number;
}

export interface SimilarFamiliesResult {
  readonly source: string;
  readonly period: string;
  readonly references: readonly Reference[];
  /** 該当する区分の件数が足りず出せなかった観点 */
  readonly unavailable: readonly string[];
}

interface RateGroup {
  readonly group: string;
  readonly count: number;
  readonly percent: number;
}

interface ShareGroup {
  readonly group: string;
  readonly count: number;
  readonly shares: Record<string, number>;
}

export function daysBand(days: number): string {
  if (days <= 3) return "3日以内";
  if (days <= 5) return "4〜5日";
  return "6日以上";
}

export function ageBand(age: number): string {
  if (age <= 64) return "64歳以下";
  if (age <= 79) return "65〜79歳";
  if (age <= 89) return "80〜89歳";
  return "90歳以上";
}

const find = <T extends { group: string }>(groups: readonly T[], key: string): T | undefined =>
  groups.find((g) => g.group === key);

/** 湯灌について、家族の事情に近い区分の選択率を返す */
export function yukanReferences(profile: FamilyProfile): SimilarFamiliesResult {
  const y = data.yukan;
  const references: Reference[] = [
    { cohort: "すべての家族", measure: "湯灌を選んだ割合", percent: y.overall.percent, count: y.overall.count },
  ];
  const unavailable: string[] = [];
  const add = (groups: readonly RateGroup[], key: string | undefined, label: (g: string) => string, axis: string): void => {
    if (key === undefined) return;
    const g = find(groups, key);
    if (!g) {
      unavailable.push(axis);
      return;
    }
    references.push({ cohort: label(g.group), measure: "湯灌を選んだ割合", percent: g.percent, count: g.count });
  };
  add(y.byDaysUntilFuneral, profile.daysUntilFuneral === undefined ? undefined : daysBand(profile.daysUntilFuneral), (g) => `葬儀まで${g}の家族`, "葬儀までの日数");
  add(y.byAge, profile.deceasedAge === undefined ? undefined : ageBand(profile.deceasedAge), (g) => `故人が${g}の家族`, "故人の年齢");
  add(y.byStyle, profile.funeralStyle, (g) => `${g}を選んだ家族`, "葬儀の形");
  return { source: data.source, period: data.period, references, unavailable };
}

/** 葬儀の形について、家族の事情に近い区分の内訳を返す */
export function funeralStyleReferences(profile: FamilyProfile): SimilarFamiliesResult {
  const f = data.funeralStyle;
  const references: Reference[] = [];
  const unavailable: string[] = [];
  const add = (groups: readonly ShareGroup[], key: string | undefined, label: (g: string) => string, axis: string): void => {
    if (key === undefined) return;
    const g = find(groups, key);
    if (!g) {
      unavailable.push(axis);
      return;
    }
    for (const [style, percent] of Object.entries(g.shares)) {
      references.push({ cohort: label(g.group), measure: `${style}を選んだ割合`, percent, count: g.count });
    }
  };
  add(f.byAge, profile.deceasedAge === undefined ? undefined : ageBand(profile.deceasedAge), (g) => `故人が${g}の家族`, "故人の年齢");
  add(f.byMembership, profile.membership, (g) => `${g}の家族`, "会員区分");
  return { source: data.source, period: data.period, references, unavailable };
}
