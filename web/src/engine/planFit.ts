/**
 * プランの提案：押し売りでも遠慮でもなく、「合うものを、根拠と一緒に、選べる形で」。
 *
 * - 3つの幅（費用を抑えたい／しっかり飾りたい／感謝の気持ちを表したい）それぞれについて、
 *   この家族に合うところと、合わないかもしれないところを、ご家族の言葉を根拠に書く
 * - ご家族の望みと品物が結びつくときは、遠慮せずに言葉にする切り出し方を出す。必ず費用を抑える選択肢と、決めるのはご家族だと伝える問いを添える
 * - 金額はモデルに書かせない（画面で価格表から出す）。並び順は費用を抑える順のまま変えない
 *
 * 止める線（機械の検査）：
 * - ご家族が費用を抑えたいと言っているのに、上の幅を「いちばん合う」にしない（ご家族が上の幅を尋ねていれば別）
 * - 費用を抑える選択肢を書いていない案は出さない
 * - 根拠の発言はご家族の実際の発言に限る
 * そのあと判定役（推奨と同じ）が言い回しを点検し、落ちたら1回だけ作り直す。それでも落ちたら出さない。
 */
import { z } from "zod";
import { ALTAR_PLANS, RANGE_LABEL, type Range } from "../domain/pricing";
import type { CaseState } from "./case";
import { checkText, type GuardViolation } from "./guard";

const RANGES = ["simple", "standard", "gratitude"] as const satisfies readonly Range[];

export const PlanFitDraftSchema = z.object({
  bestRange: z.enum(RANGES).describe("いまの会話から、いちばん合いそうな幅"),
  ranges: z
    .array(
      z.object({
        range: z.enum(RANGES),
        fitsBecause: z.string().describe("この家族に合うところ。ご家族の言葉に結びつけて一文で。合うところがなければ空文字"),
        watchOut: z.string().describe("合わないかもしれないところ、確かめたいこと。一文で。なければ空文字"),
        utteranceIds: z.array(z.string()).describe("根拠にしたご家族の発言の ID"),
      }),
    )
    .describe("3つの幅すべてについて書く"),
  howToRaise: z.string().describe("いちばん合いそうな幅を、ご家族の言葉に結びつけて切り出す言い方（担当者がそのまま口にできる言葉。金額は書かない）"),
  budgetAlternative: z.string().describe("費用を抑える幅でも、ご家族の望みをかなえられる工夫（担当者がそのまま口にできる言葉）"),
  closingQuestion: z.string().describe("決めるのはご家族だと伝えて、気持ちを尋ねる問い"),
});
export type PlanFitDraft = z.infer<typeof PlanFitDraftSchema>;

export interface PlanFitProposal extends PlanFitDraft {
  /** 画面で価格表から金額を出すためのプラン ID */
  readonly planIdByRange: Readonly<Record<Range, string>>;
}

export type PlanFitResult =
  | { readonly ok: true; readonly proposal: PlanFitProposal; readonly attempts: number; readonly rejected: readonly GuardViolation[] }
  | { readonly ok: false; readonly violations: readonly GuardViolation[]; readonly attempts: number };

/** ご家族が費用を抑えたいと話しているか */
const BUDGET_CUES = [/抑え/, /安く/, /安い/, /最低限/, /節約/, /かけられない/, /かけたくない/, /年金/, /余裕(?:が|は)?(?:ない|ありません)/, /質素/, /簡素/];
/** ご家族が上の幅や飾りを自分から尋ねているか */
const ASKED_UP_CUES = [/しっかり(?:した|と)?(?:形|葬儀|お葬式|飾)/, /立派/, /華やか/, /いちばん良い/, /一番いい/, /お金は(?:気にしない|かまわない|いい)/];

export function familyWantsToSave(state: CaseState): boolean {
  return state.utterances.some((u) => u.speaker !== "staff" && BUDGET_CUES.some((c) => c.test(u.text)));
}

export function familyAskedForMore(state: CaseState): boolean {
  return state.utterances.some((u) => u.speaker !== "staff" && ASKED_UP_CUES.some((c) => c.test(u.text)));
}

export const PLAN_FIT_SYSTEM = `あなたは、葬儀の打合せで担当者のとなりにいるベテランです。プランの提案を手伝います。
目指すのは「押し売り」でも「遠慮」でもなく、ご家族にとっていちばん合うものを、根拠と一緒に、選べる形で示すことです。
ご家族の望みと品物が本当に結びつくなら、それを伝えることはご家族のためになります。遠慮して言わないことも、ご家族の選ぶ機会を奪います。

## 書き方
- 3つの幅すべてについて、この家族に合うところと、合わないかもしれないところを書く。根拠はご家族の実際の発言（発言 ID を添える）に限る
- いちばん合いそうな幅を一つ選ぶ。ご家族が費用を抑えたいと話しているなら、ご家族が自分から上の幅を尋ねていない限り「費用を抑えたい」を選ぶ
- 切り出し方は、ご家族の言葉に結びつけた、担当者がそのまま口にできる言葉にする。例：「お花がお好きだったと伺いましたので、お好きなお花を中心にお飾りする形もございます」
- 費用を抑える幅でもご家族の望みをかなえられる工夫を、必ず書く
- 最後に、決めるのはご家族だと伝えて気持ちを尋ねる問いを書く
- 金額・割合・件数は書かない（画面で価格表から出す）
- 文章の中に発言の ID（U1 など）を書かない。ID は utteranceIds にだけ入れる

## 使わない言い回し
- 後悔・罪悪感・「最後だから」「せっかくなら」「一生に一度」で決断を迫る言い方
- 「皆さん選ばれています」など多数派に合わせさせる言い方
- 「グレードアップ」「ランクを上げる」「上のプラン」など、格上げを勧める言い方（幅は気持ちの違いとして話す）
- 世間体や親戚の目を持ち出す言い方`;

export function buildPlanFitPrompt(state: CaseState): string {
  const plans = ALTAR_PLANS.map((p) => `- ${p.range}（${RANGE_LABEL[p.range]}）：${p.label}。含まれるもの：${p.includes.join("、")}`);
  const decided = Object.entries(state.decisions).map(([id, d]) => `- ${id}：${d.value}（${d.status === "confirmed" ? "確定" : "候補"}）`);
  return [
    "# 3つの幅（並びは費用を抑える順。金額は書かない）",
    ...plans,
    "",
    "# 打合せの会話",
    ...state.utterances.map((u) => `[${u.id}] ${u.speakerLabel}：${u.text}`),
    "",
    "# わかっている事情",
    ...state.circumstances.map((c) => `- ${c.text}`),
    "",
    "# 決まっていること・候補",
    ...(decided.length > 0 ? decided : ["- まだありません"]),
    "",
    `# ご家族が費用を抑えたいと話しているか：${familyWantsToSave(state) ? "はい" : "いいえ"}`,
    `# ご家族が自分から上の幅や飾りを尋ねているか：${familyAskedForMore(state) ? "はい" : "いいえ"}`,
  ].join("\n");
}

/** 機械の検査：言い回し・止める線・根拠 */
export function validatePlanFit(draft: PlanFitDraft, state: CaseState): GuardViolation[] {
  const problems: GuardViolation[] = [];
  const texts = [draft.howToRaise, draft.budgetAlternative, draft.closingQuestion, ...draft.ranges.flatMap((r) => [r.fitsBecause, r.watchOut])];
  for (const t of texts) problems.push(...checkText(t));

  if (familyWantsToSave(state) && !familyAskedForMore(state) && draft.bestRange !== "simple") {
    problems.push({ rule: "no_budget_option", message: "ご家族が費用を抑えたいと話しているのに、費用を抑える幅以外をいちばん合うとしています" });
  }
  if (draft.budgetAlternative.trim().length === 0) {
    problems.push({ rule: "no_budget_option", message: "費用を抑える幅でもできる工夫が書かれていません" });
  }
  const missing = RANGES.filter((r) => !draft.ranges.some((x) => x.range === r));
  if (missing.length > 0) problems.push({ rule: "unknown_reference", message: `書かれていない幅があります：${missing.join("、")}` });

  const familyIds = new Set(state.utterances.filter((u) => u.speaker !== "staff").map((u) => u.id));
  for (const r of draft.ranges) {
    for (const id of r.utteranceIds) {
      if (!familyIds.has(id)) problems.push({ rule: "unknown_reference", message: `根拠にした発言がご家族の発言にありません：${id}` });
    }
  }
  return problems;
}

/** 文章に紛れ込んだ発言の ID（「（U18）」「U12・U17」など）を消す */
export function stripIds(text: string): string {
  return text
    .replace(/[（(]\s*U\d+(?:\s*[・、,，]\s*U\d+)*\s*[）)]/g, "")
    .replace(/U\d+(?:\s*[・、,，]\s*U\d+)*/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function toProposal(raw: PlanFitDraft): PlanFitProposal {
  const draft: PlanFitDraft = {
    ...raw,
    howToRaise: stripIds(raw.howToRaise),
    budgetAlternative: stripIds(raw.budgetAlternative),
    closingQuestion: stripIds(raw.closingQuestion),
    ranges: raw.ranges.map((r) => ({ ...r, fitsBecause: stripIds(r.fitsBecause), watchOut: stripIds(r.watchOut) })),
  };
  const planIdByRange = Object.fromEntries(ALTAR_PLANS.map((p) => [p.range, p.id])) as Record<Range, string>;
  // 並びは費用を抑える順に固定する
  const ranges = RANGES.map((r) => draft.ranges.find((x) => x.range === r)).filter((x): x is PlanFitDraft["ranges"][number] => x !== undefined);
  return { ...draft, ranges, planIdByRange };
}

export type GeneratePlanFit = (system: string, prompt: string) => Promise<PlanFitDraft>;
export type JudgePlanFit = (proposal: PlanFitProposal) => Promise<GuardViolation[]>;

export async function recommendPlanFit(state: CaseState, generate: GeneratePlanFit, judge: JudgePlanFit): Promise<PlanFitResult> {
  const base = buildPlanFitPrompt(state);
  let prompt = base;
  let rejected: GuardViolation[] = [];
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const draft = PlanFitDraftSchema.parse(await generate(PLAN_FIT_SYSTEM, prompt));
    const mechanical = validatePlanFit(draft, state);
    const proposal = toProposal(draft);
    const violations = mechanical.length > 0 ? mechanical : await judge(proposal);
    if (violations.length === 0) return { ok: true, proposal, attempts: attempt, rejected };
    rejected = [...rejected, ...violations];
    prompt = `${base}\n\n# 前回の案は次の理由で出せませんでした。直してください\n${violations.map((v) => `- ${v.message}${v.quote ? `（「${v.quote}」）` : ""}`).join("\n")}`;
  }
  return { ok: false, violations: rejected, attempts: 2 };
}
