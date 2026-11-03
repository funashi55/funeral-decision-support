/**
 * 守る線の機械的な検査。モデルの判定役（judge.ts）の前に必ず通す。
 * ここで落ちた推奨は表示しない。
 */

export type GuardRule = "fear_appeal" | "numbers_in_text" | "no_budget_option" | "majority_pressure" | "pressure_language";

export interface GuardViolation {
  readonly rule: GuardRule;
  readonly message: string;
  readonly quote?: string;
}

/** 遺体の変化を持ち出して不安をあおる語 */
const FEAR_WORDS = ["菌", "腐", "匂い", "臭い", "におい", "変色", "傷む", "傷んで", "悪化", "崩れ", "体液", "かわいそう", "保証できない"] as const;

/** 多数派に合わせるよう促す言い回し */
const MAJORITY_PATTERNS = [/皆さん(?:選ばれ|され)/, /ほとんどの(?:方|家族)が/, /普通は/, /一般的には.*(?:選ば|され)/, /多くの方が選ば/] as const;

/** 決断を急がせる・断りづらくする言い回し */
const PRESSURE_PATTERNS = [/今(?:しか|だけ)/, /後悔(?:しますよ|しないように)/, /せっかくなら/, /最後(?:だから|ですから)/, /ケチ/, /見栄え/] as const;

/** 金額・割合・件数の表記（数字はサーバー側で差し込むため、モデルの文章に入っていてはいけない） */
const NUMBER_PATTERN = /[0-9０-９]+(?:[,，][0-9０-９]{3})*\s*(?:円|万|%|％|割|件|人に1人)/;

function findQuote(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 12);
  return text.slice(start, index + length + 12);
}

/** モデルが書いた文章を検査する */
export function checkText(text: string): GuardViolation[] {
  const violations: GuardViolation[] = [];
  for (const word of FEAR_WORDS) {
    const i = text.indexOf(word);
    if (i >= 0) violations.push({ rule: "fear_appeal", message: `不安をあおる語「${word}」が含まれています`, quote: findQuote(text, i, word.length) });
  }
  for (const pattern of MAJORITY_PATTERNS) {
    const m = pattern.exec(text);
    if (m) violations.push({ rule: "majority_pressure", message: "多数派に合わせるよう促す言い回しです", quote: findQuote(text, m.index, m[0].length) });
  }
  for (const pattern of PRESSURE_PATTERNS) {
    const m = pattern.exec(text);
    if (m) violations.push({ rule: "pressure_language", message: "決断を急がせる、断りづらくする言い回しです", quote: findQuote(text, m.index, m[0].length) });
  }
  const n = NUMBER_PATTERN.exec(text);
  if (n) violations.push({ rule: "numbers_in_text", message: "金額や割合を文章に書いています（数字は集計表と価格表から差し込みます）", quote: findQuote(text, n.index, n[0].length) });
  return violations;
}

export interface OptionForGuard {
  readonly id: string;
  /** 追加費用がかからない、または最も費用を抑えられる選択肢か */
  readonly lowCost: boolean;
}

/** 示す選択肢の中に、費用を抑えられる選択肢が含まれているか */
export function checkBudgetOption(options: readonly OptionForGuard[]): GuardViolation[] {
  if (options.length === 0) return [];
  return options.some((o) => o.lowCost)
    ? []
    : [{ rule: "no_budget_option", message: "費用を抑えられる選択肢が含まれていません" }];
}
