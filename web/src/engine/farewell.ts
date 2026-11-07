/**
 * お別れの仕方の意思決定支援。
 *
 * モデルには ID 付きの材料（発言・選択肢・ベテランの知見・似た家族の集計）を渡し、
 * 「どれを、なぜ使うか」だけを構造化して返させる。金額・割合・できること/できないことは
 * サーバー側で差し込む。守る線の検査に落ちたら1回だけ出し直し、それでも落ちたら出さない。
 */
import { OVERSIGHT_RULES } from "./oversight";
import { familyWantsToSave } from "./planFit";
import { z } from "zod";
import { FAREWELL_OPTIONS, getFarewellOption, type FarewellOptionId } from "../domain/farewell";
import { getCatalogItem } from "../domain/pricing";
import { yukanReferences, type Reference } from "../domain/similarFamilies";
import { GRIEF_PRINCIPLES, GRIEF_PRINCIPLE_IDS, type GriefPrincipleId } from "../domain/griefCare";
import { loadKnowledge, rulesFor, withRecordRules, type Knowledge, type Rule } from "../knowledge/rules";
import type { CaseState } from "./case";
import { checkBudgetOption, checkText, type GuardViolation } from "./guard";

const FAREWELL_DECISIONS = ["laying_in_style", "embalming", "resting_place", "cremation_date", "face_viewing"] as const;
const OPTION_IDS = FAREWELL_OPTIONS.map((o) => o.id) as [FarewellOptionId, ...FarewellOptionId[]];

export const FarewellDraftSchema = z.object({
  familyWish: z.string().describe("家族の言葉から読み取った、家族が望むお別れの形。断定せず『〜と望まれているようです』の形で"),
  options: z
    .array(
      z.object({
        optionId: z.enum(OPTION_IDS),
        fit: z.enum(["suits", "consider", "not_now"]).describe("suits=家族の望みに合う / consider=尋ねてみる価値がある / not_now=今回は合わない"),
        reason: z.string().describe("この家族にとっての理由。金額や割合の数字は書かない"),
        howToRaise: z
          .string()
          .describe(
            "この会話の流れで担当者が自然に切り出すときの言い方の例（担当者がそのまま、または言い換えて使う）。話し言葉で1〜2文に収め、できること・できないことの説明は繰り返さない（画面に別に出る）。ご家族の言葉につなげ、望むかを尋ねる形にする。not_now は、押しつけずに軽く触れる言い方か、触れずにおくなら『今回は触れなくてよさそうです』と書く",
          ),
        utteranceIds: z.array(z.string()),
        ruleIds: z.array(z.string()),
      }),
    )
    .describe("すべての選択肢を評価する"),
  referenceIds: z.array(z.string()).describe("担当者に見せる似た家族の参考値の ID。家族の事情に近いものだけ"),
  timeAdvice: z.string().describe("火葬までの時間の使い方についての助言。数字は書かない"),
  questionsToAsk: z.array(z.string()).describe("担当者が家族に尋ねるとよい問い。最大3つ"),
  griefCare: z
    .array(
      z.object({
        principleId: z.enum(GRIEF_PRINCIPLE_IDS),
        observation: z.string().describe("会話のどこから、この配慮が要ると見たか。断定せず『〜のようです』の形で"),
        words: z.string().describe("この場面で担当者がかけるとよい言葉の例。話し言葉で1〜2文。ご家族の言葉や故人の呼び方に合わせる。過去と今のことを受け止めるだけにし、これからのお見送り・送り方・お別れの形には触れない（あとの提案の前振りにしない）。選択肢（湯灌・エンバーミングなど）や費用に触れない"),
        utteranceIds: z.array(z.string()),
      }),
    )
    .describe("ご遺族への配慮（グリーフケア）。この会話で特に大事なものを最大3つ。当てはまるものがなければ空。ご家族が口にしていない気持ちを決めつけない（例：anticipatory（看病のあとの安堵）は、ご家族が安堵や疲れを口にした発言があるときだけ選ぶ）"),
  // 一覧にない ID が返っても読み取りを止めないよう文字列で受け、使うときに一覧にあるものだけを残す
  cautionIds: z
    .array(z.string())
    .describe(`取り返しのつかない見落としの注意を、決まった一覧から選ぶ（文章は書かない）。会話から当てはまるものだけ。なければ空。\n${OVERSIGHT_RULES.map((r) => `- ${r.id}：${r.message}`).join("\n")}`),
});

export type FarewellDraft = z.infer<typeof FarewellDraftSchema>;

export interface FarewellContext {
  readonly prompt: string;
  readonly references: ReadonlyMap<string, Reference>;
  readonly rules: ReadonlyMap<string, Rule>;
  readonly utteranceIds: ReadonlySet<string>;
  /** ご家族が費用を抑えたいと話したか（そのときは費用のかからない選択肢を「合う」に入れる） */
  readonly wantsToSave?: boolean;
}

/** knowledge を渡すと、その知見で推奨を作る（聞き取りの前後の比べ方に使う） */
export function buildFarewellContext(state: CaseState, knowledge: Knowledge = withRecordRules(loadKnowledge())): FarewellContext {
  const rules = rulesFor(knowledge, [...FAREWELL_DECISIONS]);
  const refs = yukanReferences(state.profile).references;
  const references = new Map(refs.map((r, i) => [`REF-${i + 1}`, r]));
  const lines = [
    "# 打合せの発言",
    ...state.utterances.map((u) => `[${u.id}] ${u.speakerLabel}：${u.text}`),
    "",
    "# 拾い上げた家族の事情",
    ...state.circumstances.map((c) => `- ${c.text}`),
    "",
    "# お別れの仕方の選択肢（事実。言い換えずに使う）",
    ...FAREWELL_OPTIONS.map((o) => `- ${o.id}：${o.label}。${o.summary} できること：${o.canDo.join("／")}。できないこと：${o.cannotDo.join("／")}。決める期限：${o.deadline}`),
    "",
    "# ベテランの知見",
    ...rules.map((r) => `[${r.id}] ${r.when}は、${r.do}。理由：${r.why}`),
    "",
    "# ご遺族への配慮の考え方（死別の研究に基づく。ID で選び、言葉は場面に合わせて書く）",
    ...GRIEF_PRINCIPLES.map((p) => `[${p.id}] ${p.name}：${p.principle} 当てはまる様子：${p.signals}。避けたい言葉：${p.avoid.map((a) => `「${a.words}」`).join("")}`),
    "",
    "# 似た家族の選び方（参考値。数字はサーバーが表示するので、あなたは ID だけを選ぶ）",
    ...[...references].map(([id, r]) => `[${id}] ${r.cohort}・${r.measure}`),
  ];
  const wantsToSave = familyWantsToSave(state);
  if (wantsToSave) lines.push("", "# 大事な前提", "ご家族は費用を抑えたいと話しています。費用のかからない「通常の納棺」（standard_laying）を必ず「合う」（suits）にしてください。");
  return {
    prompt: lines.join("\n"),
    references,
    rules: new Map(rules.map((r) => [r.id, r])),
    utteranceIds: new Set(state.utterances.map((u) => u.id)),
    wantsToSave,
  };
}

export const FAREWELL_SYSTEM = `あなたは葬儀社のベテラン担当者として、経験の浅い担当者の隣で打合せを支えます。
いま家族と決めようとしているのは「お別れの仕方」（納棺の形、湯灌、エンバーミング、火葬までの時間の使い方）です。

守ること：
- すべて日本語で書く（英語や他の言語にしない）
- 家族の言葉から、家族が望むお別れの形を読み取る。断定しない
- 有料の選択肢を勧めるために、遺体の変化（菌・匂い・変色など）を持ち出して不安をあおらない
- 家族が罪悪感や後悔を口にしたとき（「何もしてあげられなかった」など）、その気持ちを有料の選択肢の理由にしない。故人のつらそうだった姿を持ち出さず、「やっておけばよかった」と後悔を先回りしない。まず気持ちを受け止め、望むかを尋ねる
- 「皆さん選ばれています」のように多数派に合わせるよう促さない。似た家族の選び方は参考として ID で示すだけ
- 費用のかからない通常の納棺を必ず選択肢として評価する
- 金額・割合・件数の数字を文章に書かない（サーバーが正しい値を差し込む）
- 根拠にした発言と知見の ID を必ず添える。材料にない ID を作らない
- 選択肢ごとに、この会話の流れで自然に切り出す言い方の例（howToRaise）を添える。ご家族が口にした言葉につなげ、望むかを尋ねる形にする。「今回は合わない」ものは無理に勧めず、軽く触れるか触れずにおく
- ご遺族への配慮（griefCare）は、材料の「配慮の考え方」から会話に当てはまるものだけを選び、かける言葉の例を書く。悲しみ方に順番はないので、段階に当てはめない。配慮の言葉で選択肢や費用に触れない（気持ちへの配慮を販売の理由にしない）。配慮の言葉は、ご家族のこれまでと今の気持ちを受け止めるところで終える。「〜できるように一緒に考えましょう」のように、これからのお別れの形・お見送りの仕方に話を進めない（あとの提案の前振りになるため）。ご家族が口にしていない気持ち（後悔・安堵など）を決めつけない
- 言葉はすべて例。使うか、どう言うかは担当者が決める
- あなたの出力は担当者だけが見る。家族への伝え方は担当者が決める`;

/** 選択肢の事実（モデルが書かない部分）。推奨を出せないときも、これだけは並べられる */
export interface OptionFacts {
  readonly id: FarewellOptionId;
  readonly label: string;
  readonly canDo: readonly string[];
  readonly cannotDo: readonly string[];
  readonly reversible: boolean;
  readonly deadline: string;
  /** null はプランに含まれる */
  readonly price: { readonly amount: number; readonly unit: string } | null;
}

export function optionFacts(id: FarewellOptionId): OptionFacts {
  const option = getFarewellOption(id);
  const item = option.catalogItemId ? getCatalogItem(option.catalogItemId) : null;
  return {
    id: option.id,
    label: option.label,
    canDo: option.canDo,
    cannotDo: option.cannotDo,
    reversible: option.reversible,
    deadline: option.deadline,
    price: item ? { amount: item.unitPrice, unit: item.unit } : null,
  };
}

/** 費用のかからない選択肢を先頭にした、すべての選択肢の事実 */
export function allOptionFacts(): OptionFacts[] {
  return [...OPTION_IDS].map(optionFacts).sort((a, b) => Number(a.price !== null) - Number(b.price !== null));
}

export interface EnrichedOption extends OptionFacts {
  readonly fit: FarewellDraft["options"][number]["fit"];
  readonly reason: string;
  /** この会話の流れでの切り出し方の例 */
  readonly howToRaise: string;
  readonly evidence: { readonly utteranceIds: readonly string[]; readonly rules: readonly Rule[] };
}

export interface FarewellRecommendation {
  readonly familyWish: string;
  readonly options: readonly EnrichedOption[];
  readonly references: readonly (Reference & { readonly id: string })[];
  readonly referenceSource: string;
  readonly timeAdvice: string;
  readonly questionsToAsk: readonly string[];
  /** 理論の説明・出典・避けたい言葉は domain/griefCare.ts から画面で引く（判定役に避けたい言葉を誤検出させない） */
  readonly griefCare: readonly { readonly principleId: GriefPrincipleId; readonly observation: string; readonly words: string; readonly utteranceIds: readonly string[] }[];
  readonly cautions: readonly { readonly id: string; readonly decisionId: string; readonly label: string; readonly level: "must" | "check"; readonly message: string }[];
}

/** 配慮の言葉に出てきてはいけない語（有料の選択肢と費用） */
const PAID_OPTION_WORDS = ["湯灌", "エンバーミング", "安置", "延ば", "費用", "料金", "円", "プラン"] as const;

/** モデルの出力が材料に沿っているか、守る線を外していないかを検査する */
export function validateDraft(draft: FarewellDraft, ctx: FarewellContext): GuardViolation[] {
  const problems: GuardViolation[] = [];
  const texts = [draft.familyWish, draft.timeAdvice, ...draft.questionsToAsk, ...draft.options.flatMap((o) => [o.reason, o.howToRaise]), ...draft.griefCare.flatMap((g) => [g.observation, g.words])];
  for (const t of texts) problems.push(...checkText(t));

  const shown = draft.options.filter((o) => o.fit !== "not_now");
  problems.push(...checkBudgetOption(shown.map((o) => ({ id: o.optionId, lowCost: getFarewellOption(o.optionId).catalogItemId === null }))));
  if (ctx.wantsToSave && !draft.options.some((o) => o.fit === "suits" && getFarewellOption(o.optionId).catalogItemId === null)) {
    problems.push({ rule: "upsell", message: "ご家族は費用を抑えたいと話しています。費用のかからない選択肢を「合う」に入れてください" });
  }

  const unknown = (kind: string, id: string): GuardViolation => ({ rule: "unknown_reference", message: `材料にない${kind}の ID を使っています: ${id}` });
  for (const o of draft.options) {
    for (const id of o.utteranceIds) if (!ctx.utteranceIds.has(id)) problems.push(unknown("発言", id));
    for (const id of o.ruleIds) if (!ctx.rules.has(id)) problems.push(unknown("知見", id));
  }
  for (const g of draft.griefCare) {
    for (const id of g.utteranceIds) if (!ctx.utteranceIds.has(id)) problems.push(unknown("発言", id));
    const mentioned = PAID_OPTION_WORDS.find((w) => g.words.includes(w));
    if (mentioned) problems.push({ rule: "upsell", message: "ご遺族への配慮の言葉で、有料の選択肢に触れています（気持ちへの配慮を販売の理由にしない）", quote: mentioned });
  }
  for (const id of draft.referenceIds) if (!ctx.references.has(id)) problems.push(unknown("参考値", id));
  return problems;
}

/** 金額・割合・事実をサーバー側で差し込む */
export function enrichDraft(draft: FarewellDraft, ctx: FarewellContext, referenceSource: string): FarewellRecommendation {
  const fitOrder = { suits: 0, consider: 1, not_now: 2 } as const;
  const options = [...draft.options]
    .sort((a, b) => fitOrder[a.fit] - fitOrder[b.fit])
    .map(
      (o): EnrichedOption => ({
        ...optionFacts(o.optionId),
        fit: o.fit,
        reason: o.reason,
        howToRaise: o.howToRaise,
        evidence: { utteranceIds: o.utteranceIds, rules: o.ruleIds.map((id) => ctx.rules.get(id) as Rule) },
      }),
    );
  return {
    familyWish: draft.familyWish,
    options,
    references: draft.referenceIds.map((id) => ({ id, ...(ctx.references.get(id) as Reference) })),
    referenceSource,
    timeAdvice: draft.timeAdvice,
    questionsToAsk: draft.questionsToAsk.slice(0, 3),
    griefCare: draft.griefCare.slice(0, 3),
    // 注意は決まった一覧から選ばせ、文面は一覧の固定の文を使う（モデルに注意の文章を書かせない）
    cautions: [...new Set(draft.cautionIds)].flatMap((id) => {
      const rule = OVERSIGHT_RULES.find((r) => r.id === id);
      return rule ? [{ id, decisionId: rule.decisionId, label: rule.title, level: rule.level, message: rule.message }] : [];
    }),
  };
}

export type GenerateDraft = (system: string, prompt: string) => Promise<FarewellDraft>;
export type JudgeDraft = (recommendation: FarewellRecommendation) => Promise<GuardViolation[]>;

export type FarewellResult =
  | { readonly ok: true; readonly recommendation: FarewellRecommendation; readonly attempts: number; readonly rejected: readonly GuardViolation[] }
  | {
      readonly ok: false;
      readonly violations: readonly GuardViolation[];
      readonly attempts: number;
      /** 推奨の代わりに並べる、選択肢の事実だけ（モデルの文章を含まない） */
      readonly facts: readonly OptionFacts[];
    };

/** 生成 → 機械検査 → 判定役。落ちたら指摘を添えて1回だけ出し直す */
export async function recommendFarewell(state: CaseState, generate: GenerateDraft, judge: JudgeDraft, knowledge?: Knowledge, style = ""): Promise<FarewellResult> {
  const ctx = buildFarewellContext(state, knowledge);
  const source = yukanReferences(state.profile).source;
  // 担当者の話し方（言い方だけ。守る線の検査は同じように通す）
  const base = ctx.prompt + style;
  let prompt = base;
  let rejected: GuardViolation[] = [];
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const draft = FarewellDraftSchema.parse(await generate(FAREWELL_SYSTEM, prompt));
    const mechanical = validateDraft(draft, ctx);
    const violations = mechanical.length > 0 ? mechanical : await judge(enrichDraft(draft, ctx, source));
    if (violations.length === 0) {
      return { ok: true, recommendation: enrichDraft(draft, ctx, source), attempts: attempt, rejected };
    }
    rejected = [...rejected, ...violations];
    prompt = `${base}\n\n# 前回の案は次の理由で出せませんでした。直してください\n${violations.map((v) => `- ${v.message}${v.quote ? `（「${v.quote}」）` : ""}`).join("\n")}`;
  }
  return { ok: false, violations: rejected, attempts: 2, facts: allOptionFacts() };
}
