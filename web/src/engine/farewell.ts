/**
 * お別れの仕方の意思決定支援。
 *
 * モデルには ID 付きの材料（発言・選択肢・ベテランの知見・似た家族の集計）を渡し、
 * 「どれを、なぜ使うか」だけを構造化して返させる。金額・割合・できること/できないことは
 * サーバー側で差し込む。守る線の検査に落ちたら1回だけ出し直し、それでも落ちたら出さない。
 */
import { z } from "zod";
import { FAREWELL_OPTIONS, getFarewellOption, type FarewellOptionId } from "../domain/farewell";
import { getCatalogItem } from "../domain/pricing";
import { yukanReferences, type Reference } from "../domain/similarFamilies";
import { DECISIONS, getDecision } from "../domain/decisions";
import { loadKnowledge, rulesFor, type Rule } from "../knowledge/rules";
import type { CaseState } from "./case";
import { checkBudgetOption, checkText, type GuardViolation } from "./guard";

const FAREWELL_DECISIONS = ["laying_in_style", "embalming", "resting_place", "cremation_date", "face_viewing"] as const;
const DECISION_IDS = DECISIONS.map((d) => d.id) as [string, ...string[]];
const OPTION_IDS = FAREWELL_OPTIONS.map((o) => o.id) as [FarewellOptionId, ...FarewellOptionId[]];

export const FarewellDraftSchema = z.object({
  familyWish: z.string().describe("家族の言葉から読み取った、家族が望むお別れの形。断定せず『〜と望まれているようです』の形で"),
  options: z
    .array(
      z.object({
        optionId: z.enum(OPTION_IDS),
        fit: z.enum(["suits", "consider", "not_now"]).describe("suits=家族の望みに合う / consider=尋ねてみる価値がある / not_now=今回は合わない"),
        reason: z.string().describe("この家族にとっての理由。金額や割合の数字は書かない"),
        utteranceIds: z.array(z.string()),
        ruleIds: z.array(z.string()),
      }),
    )
    .describe("すべての選択肢を評価する"),
  referenceIds: z.array(z.string()).describe("担当者に見せる似た家族の参考値の ID。家族の事情に近いものだけ"),
  timeAdvice: z.string().describe("火葬までの時間の使い方についての助言。数字は書かない"),
  questionsToAsk: z.array(z.string()).describe("担当者が家族に尋ねるとよい問い。最大3つ"),
  cautions: z
    .array(z.object({ decisionId: z.enum(DECISION_IDS).describe("決定項目の ID（お別れの選択肢の ID ではない）"), message: z.string() }))
    .describe("取り返しのつかない見落としの注意。なければ空"),
});

export type FarewellDraft = z.infer<typeof FarewellDraftSchema>;

export interface FarewellContext {
  readonly prompt: string;
  readonly references: ReadonlyMap<string, Reference>;
  readonly rules: ReadonlyMap<string, Rule>;
  readonly utteranceIds: ReadonlySet<string>;
}

export function buildFarewellContext(state: CaseState): FarewellContext {
  const knowledge = loadKnowledge();
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
    "# 似た家族の選び方（参考値。数字はサーバーが表示するので、あなたは ID だけを選ぶ）",
    ...[...references].map(([id, r]) => `[${id}] ${r.cohort}・${r.measure}`),
  ];
  return {
    prompt: lines.join("\n"),
    references,
    rules: new Map(rules.map((r) => [r.id, r])),
    utteranceIds: new Set(state.utterances.map((u) => u.id)),
  };
}

export const FAREWELL_SYSTEM = `あなたは葬儀社のベテラン担当者として、経験の浅い担当者の隣で打合せを支えます。
いま家族と決めようとしているのは「お別れの仕方」（納棺の形、湯灌、エンバーミング、火葬までの時間の使い方）です。

守ること：
- 家族の言葉から、家族が望むお別れの形を読み取る。断定しない
- 有料の選択肢を勧めるために、遺体の変化（菌・匂い・変色など）を持ち出して不安をあおらない
- 家族が罪悪感や後悔を口にしたとき（「何もしてあげられなかった」など）、その気持ちを有料の選択肢の理由にしない。故人のつらそうだった姿を持ち出さず、「やっておけばよかった」と後悔を先回りしない。まず気持ちを受け止め、望むかを尋ねる
- 「皆さん選ばれています」のように多数派に合わせるよう促さない。似た家族の選び方は参考として ID で示すだけ
- 費用のかからない通常の納棺を必ず選択肢として評価する
- 金額・割合・件数の数字を文章に書かない（サーバーが正しい値を差し込む）
- 根拠にした発言と知見の ID を必ず添える。材料にない ID を作らない
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
  readonly evidence: { readonly utteranceIds: readonly string[]; readonly rules: readonly Rule[] };
}

export interface FarewellRecommendation {
  readonly familyWish: string;
  readonly options: readonly EnrichedOption[];
  readonly references: readonly (Reference & { readonly id: string })[];
  readonly referenceSource: string;
  readonly timeAdvice: string;
  readonly questionsToAsk: readonly string[];
  readonly cautions: readonly { readonly decisionId: string; readonly label: string; readonly message: string }[];
}

/** モデルの出力が材料に沿っているか、守る線を外していないかを検査する */
export function validateDraft(draft: FarewellDraft, ctx: FarewellContext): GuardViolation[] {
  const problems: GuardViolation[] = [];
  const texts = [draft.familyWish, draft.timeAdvice, ...draft.questionsToAsk, ...draft.options.map((o) => o.reason), ...draft.cautions.map((c) => c.message)];
  for (const t of texts) problems.push(...checkText(t));

  const shown = draft.options.filter((o) => o.fit !== "not_now");
  problems.push(...checkBudgetOption(shown.map((o) => ({ id: o.optionId, lowCost: getFarewellOption(o.optionId).catalogItemId === null }))));

  const unknown = (kind: string, id: string): GuardViolation => ({ rule: "unknown_reference", message: `材料にない${kind}の ID を使っています: ${id}` });
  for (const o of draft.options) {
    for (const id of o.utteranceIds) if (!ctx.utteranceIds.has(id)) problems.push(unknown("発言", id));
    for (const id of o.ruleIds) if (!ctx.rules.has(id)) problems.push(unknown("知見", id));
  }
  for (const id of draft.referenceIds) if (!ctx.references.has(id)) problems.push(unknown("参考値", id));
  for (const c of draft.cautions) {
    try {
      getDecision(c.decisionId);
    } catch {
      problems.push(unknown("決定項目", c.decisionId));
    }
  }
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
    cautions: draft.cautions.map((c) => ({ ...c, label: getDecision(c.decisionId).label })),
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
export async function recommendFarewell(state: CaseState, generate: GenerateDraft, judge: JudgeDraft): Promise<FarewellResult> {
  const ctx = buildFarewellContext(state);
  const source = yukanReferences(state.profile).source;
  let prompt = ctx.prompt;
  let rejected: GuardViolation[] = [];
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const draft = FarewellDraftSchema.parse(await generate(FAREWELL_SYSTEM, prompt));
    const mechanical = validateDraft(draft, ctx);
    const violations = mechanical.length > 0 ? mechanical : await judge(enrichDraft(draft, ctx, source));
    if (violations.length === 0) {
      return { ok: true, recommendation: enrichDraft(draft, ctx, source), attempts: attempt, rejected };
    }
    rejected = [...rejected, ...violations];
    prompt = `${ctx.prompt}\n\n# 前回の案は次の理由で出せませんでした。直してください\n${violations.map((v) => `- ${v.message}${v.quote ? `（「${v.quote}」）` : ""}`).join("\n")}`;
  }
  return { ok: false, violations: rejected, attempts: 2, facts: allOptionFacts() };
}
