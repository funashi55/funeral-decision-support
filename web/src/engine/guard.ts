/**
 * 守る線の機械的な検査。モデルの判定役（judge.ts）の前に必ず通す。
 * ここで落ちた推奨は表示しない。
 */

export type GuardRule = "fear_appeal" | "numbers_in_text" | "no_budget_option" | "majority_pressure" | "pressure_language" | "upsell" | "unknown_reference";

export interface GuardViolation {
  readonly rule: GuardRule;
  readonly message: string;
  readonly quote?: string;
}

/**
 * 遺体の変化を持ち出して不安をあおる言い回し。
 * 単語だけで止めると「病状が悪化して入院」「泣き崩れ」「花の匂い」まで止まるため、
 * お体・お顔と変化の語の組み合わせで見る
 */
const FEAR_PATTERNS = [
  /菌/,
  /腐/,
  /体液/,
  /変色/,
  /臭/,
  /かわいそう/,
  /保証(?:でき|いたしかね|しかね)/,
  /傷み|傷んで|傷む/,
  /きれいな(?:お顔の|お姿の)?うちに/,
  /(?:匂い|におい)が(?:出|して|強|気に|こも)/,
  /(?:お体|お顔|ご遺体|お肌|お姿|状態)[^。、]{0,6}(?:崩れ|色が変わ|悪化|もたな|むくみ|黒ず|変わってしま)/,
] as const;

/** 多数派に合わせるよう促す言い回し */
const MAJORITY_PATTERNS = [
  /(?:皆さん|みなさん|皆様)(?:が)?(?:選ばれ|され)/,
  /ほとんどの(?:方|ご家族|家族)が/,
  /多くの(?:方|ご家族|家族)が/,
  /大半の/,
  /半数(?:以上)?の/,
  /普通は/,
  /当たり前/,
  /一般的には.*(?:選ば|され)/,
] as const;

/** 決断を急がせる・断りづらくする言い回し */
const PRESSURE_PATTERNS = [
  /今(?:しか|だけ)/,
  /今日中に決め/,
  /間に合いません/,
  /後悔(?:しますよ|しないように|されます)/,
  /悔やまれ/,
  /せっかくなら/,
  /最後(?:だから|ですから|くらい)/,
  /最後の親孝行/,
  /(?:親戚|親族|周り|世間)の(?:方の|方々の)?目/,
  /世間体/,
  /ケチ/,
  /見栄え/,
] as const;

/**
 * 基本の内容に上乗せする販売を勧める言い回し。
 * 施行の記録では、一日葬の家族の多くで祭壇のグレードアップや遺骨のアクセサリーが足されていた（売る側の都合が混ざりやすい）
 */
const UPSELL_PATTERNS = [
  /グレードアップ/,
  /ランク(?:を)?上げ/,
  /上(?:の|位の)(?:プラン|コース|祭壇)/,
  /ソウルジュエリー|遺骨(?:の)?(?:アクセサリー|ペンダント|ジュエリー)/,
  /(?:せっかく|一生に一度).{0,8}(?:祭壇|お花|プラン)/,
] as const;

/**
 * 金額・割合・件数の表記（数字はサーバー側で差し込むため、モデルの文章に入っていてはいけない）。
 * 日数や時刻（3日後、2時間）は止めない
 */
const NUMBER_PATTERNS = [
  /[0-9０-９][0-9０-９,，.．]*\s*(?:円|万|%|％|割|件|人に[1１一]人)/,
  /[〇一二三四五六七八九十百千万]+円/,
  /[一二三四五六七八九十]割/,
  /[一二三四五六七八九十百]+人に一人/,
] as const;

function findQuote(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 12);
  return text.slice(start, index + length + 12);
}

/** モデルが書いた文章を検査する */
export function checkText(text: string): GuardViolation[] {
  const violations: GuardViolation[] = [];
  for (const pattern of FEAR_PATTERNS) {
    const m = pattern.exec(text);
    if (m) violations.push({ rule: "fear_appeal", message: `不安をあおる言い回し「${m[0]}」が含まれています`, quote: findQuote(text, m.index, m[0].length) });
  }
  for (const pattern of MAJORITY_PATTERNS) {
    const m = pattern.exec(text);
    if (m) violations.push({ rule: "majority_pressure", message: "多数派に合わせるよう促す言い回しです", quote: findQuote(text, m.index, m[0].length) });
  }
  for (const pattern of PRESSURE_PATTERNS) {
    const m = pattern.exec(text);
    if (m) violations.push({ rule: "pressure_language", message: "決断を急がせる、断りづらくする言い回しです", quote: findQuote(text, m.index, m[0].length) });
  }
  for (const pattern of UPSELL_PATTERNS) {
    const m = pattern.exec(text);
    if (m) violations.push({ rule: "upsell", message: "基本の内容への上乗せ（グレードアップや追加の品）を勧める言い回しです", quote: findQuote(text, m.index, m[0].length) });
  }
  for (const pattern of NUMBER_PATTERNS) {
    const m = pattern.exec(text);
    if (!m) continue;
    violations.push({ rule: "numbers_in_text", message: "金額や割合を文章に書いています（数字は集計表と価格表から差し込みます）", quote: findQuote(text, m.index, m[0].length) });
    break;
  }
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
