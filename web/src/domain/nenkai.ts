/**
 * 年回表（中陰月日表と年忌の一覧）。亡くなった日から、七日ごとの法要・四十九日・百か日・年忌の日付を数える。
 * AI を使わない計算。数え方は「亡くなった日を1日目」とする（初七日は亡くなった日を含めて7日目）。
 * 地域や寺院によって数え方（前日から数える、など）が違うことがあるので、表にその旨を必ず添える。
 */

export interface NenkaiRow {
  readonly name: string;
  /** 別名（例：七七日 → 四十九日） */
  readonly alias?: string;
  /** YYYY-MM-DD */
  readonly date: string;
}

export interface NenkaiTable {
  readonly deathDate: string;
  readonly chuin: readonly NenkaiRow[];
  readonly nenki: readonly NenkiRow[];
  /** 四十九日が亡くなった月から数えて3つの月にまたがる（「三月越し」として三十五日で忌明けとする地域がある） */
  readonly spansThreeMonths: boolean;
}

export type NenkiRow = NenkaiRow;

/** 亡くなった日に足す日数（亡くなった日を1日目とする） */
const CHUIN: readonly { readonly name: string; readonly alias?: string; readonly plus: number }[] = [
  { name: "初七日", plus: 6 },
  { name: "二七日", plus: 13 },
  { name: "三七日", plus: 20 },
  { name: "四七日", plus: 27 },
  { name: "五七日", alias: "三十五日", plus: 34 },
  { name: "六七日", plus: 41 },
  { name: "七七日", alias: "四十九日（忌明け）", plus: 48 },
  { name: "百か日", plus: 99 },
];

/** 年忌：亡くなった年に足す年数（一周忌は1年後、三回忌は2年後） */
const NENKI: readonly { readonly name: string; readonly years: number }[] = [
  { name: "一周忌", years: 1 },
  { name: "三回忌", years: 2 },
  { name: "七回忌", years: 6 },
  { name: "十三回忌", years: 12 },
  { name: "十七回忌", years: 16 },
  { name: "二十三回忌", years: 22 },
  { name: "二十七回忌", years: 26 },
  { name: "三十三回忌", years: 32 },
];

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

function parse(date: string): Date {
  const m = ISO.exec(date);
  if (!m) throw new Error(`日付の形が正しくありません：${date}`);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (d.toISOString().slice(0, 10) !== date) throw new Error(`ない日付です：${date}`);
  return d;
}

const iso = (d: Date): string => d.toISOString().slice(0, 10);

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

/** 年を足す。2月29日に亡くなった方の年忌で、うるう年でない年は2月28日にする */
function addYears(d: Date, years: number): Date {
  const y = d.getUTCFullYear() + years;
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(day, last)));
}

export function buildNenkai(deathDate: string): NenkaiTable {
  const death = parse(deathDate);
  const chuin = CHUIN.map((c) => ({ name: c.name, ...(c.alias ? { alias: c.alias } : {}), date: iso(addDays(death, c.plus)) }));
  const nenki = NENKI.map((n) => ({ name: n.name, date: iso(addYears(death, n.years)) }));
  const fortyNinth = addDays(death, 48);
  const months = (fortyNinth.getUTCFullYear() - death.getUTCFullYear()) * 12 + fortyNinth.getUTCMonth() - death.getUTCMonth();
  return { deathDate, chuin, nenki, spansThreeMonths: months >= 2 };
}

const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"] as const;

/** 2026年11月11日（水）・令和8年 の形にする */
export function formatJa(date: string): { readonly western: string; readonly japanese: string } {
  const d = parse(date);
  const western = `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日（${WEEKDAY[d.getUTCDay()]}）`;
  const japanese = new Intl.DateTimeFormat("ja-JP-u-ca-japanese", { era: "long", year: "numeric", timeZone: "UTC" }).format(d);
  return { western, japanese };
}
