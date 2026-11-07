/**
 * Claude の呼び出し。打合せの最中に出すもの（いまの見立て・寄り添いと提案・プランの見立て・窓口の案内役・ロールプレイのご遺族役）は
 * 会話に追いつくことを優先して Haiku。守る線の判定役と、打合せのあとの書類・判断の取り出しは Opus。
 * すべて構造化出力で受け取り、応答を控えた場合と形が崩れた場合は例外にする。
 */
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { MODEL_FAST, MODEL_REASONING, ModelOutputError, ModelRefusedError, getClient } from "./client";
import type { ChatModel } from "./familyChat";
import { FarewellDraftSchema, type FarewellDraft, type FarewellRecommendation } from "./farewell";
import type { GuardRule, GuardViolation } from "./guard";
import {
  ExtractionSchema,
  FamilyReplySchema,
  type ExtractModel,
  type Extraction,
  type FamilyModel,
  type FamilyReply,
} from "./hearing";
import { PaperworkDraftSchema, type PaperworkDraft } from "./paperwork";
import { PlanFitDraftSchema, type PlanFitDraft, type PlanFitProposal } from "./planFit";
import { QuickFitSchema, type QuickFitDraft } from "./quickFit";
import { SpeakerAnswerSchema, type ClassifySpeaker } from "./speaker";

interface ParsedResponse<T> {
  readonly stop_reason: string | null;
  readonly stop_details?: { readonly category?: string | null } | null;
  readonly parsed_output: T | null;
}

function unwrap<T>(response: ParsedResponse<T>): T {
  if (response.stop_reason === "refusal") throw new ModelRefusedError(response.stop_details?.category ?? null);
  if (response.parsed_output === null) throw new ModelOutputError(`構造化出力を読み取れませんでした（stop_reason: ${response.stop_reason}）`);
  return response.parsed_output;
}

export async function generateFarewellDraft(system: string, prompt: string): Promise<FarewellDraft> {
  const response = await getClient().messages.parse({
    model: MODEL_FAST,
    // 打合せの速さに合わせて、考える時間をとらない（文面の質は判定役と検査で守る）
    thinking: { type: "disabled" },
    max_tokens: 8000,
    system,
    output_config: { effort: "low", format: zodOutputFormat(FarewellDraftSchema) },
    messages: [{ role: "user", content: prompt }],
  });
  return unwrap(response as ParsedResponse<FarewellDraft>);
}

const JUDGE_RULES = ["fear_appeal", "majority_pressure", "pressure_language", "no_budget_option", "upsell", "numbers_in_text"] as const satisfies readonly GuardRule[];

const JudgeSchema = z.object({
  violations: z.array(
    z.object({
      rule: z.enum(JUDGE_RULES),
      message: z.string().describe("どこがなぜ問題か。担当者に分かる日本語で"),
      quote: z.string().describe("問題の箇所の引用"),
    }),
  ),
});

const JUDGE_SYSTEM = `あなたは葬儀社の推奨文を点検する審査役です。悲しみの中にある遺族は、言われるがままに有料の選択肢を選びがちです。
次の推奨（担当者向け）が、遺族を誘導していないかを厳しく点検してください。問題がなければ violations は空にします。

止めるもの：
- fear_appeal：遺体の変化や「かわいそう」など、不安や罪悪感をあおって有料の選択肢へ導く表現（遠回しな表現も含む）
- majority_pressure：多数派に合わせるよう促す表現。参考値を「だから選ぶべき」の根拠に使っている
- pressure_language：決断を急がせる、断りづらくする表現
- no_budget_option：費用を抑えたいという家族の意向があるのに、有料の選択肢だけを推している
- upsell：基本の内容への上乗せ（祭壇のグレードアップ、遺骨のアクセサリーなどの追加の品）を、家族が望む前に勧めている
止めないもの：できること・できないことの中立な説明、家族の言葉に基づく理由、家族に望むかを尋ねる問い、気持ちを受け止めるねぎらいや配慮の言葉（griefCare。ただし有料の選択肢へつなげていないもの）、押しつけずに望むかを尋ねる切り出し方（howToRaise）`;

export async function judgeRecommendation(recommendation: FarewellRecommendation): Promise<GuardViolation[]> {
  const response = await getClient().messages.parse({
    model: MODEL_REASONING,
    max_tokens: 4000,
    system: JUDGE_SYSTEM,
    output_config: { effort: "low", format: zodOutputFormat(JudgeSchema) },
    messages: [{ role: "user", content: JSON.stringify(recommendation, null, 2) }],
  });
  return unwrap(response as ParsedResponse<z.infer<typeof JudgeSchema>>).violations;
}

/** 遺族の窓口の案内役。返事の速さを優先して effort は low */
export const familyChatModel: ChatModel = async ({ system, messages, tools }) => {
  const response = await getClient().messages.create({
    model: MODEL_FAST,
    // 打合せの速さに合わせて、考える時間をとらない（文面の質は判定役と検査で守る）
    thinking: { type: "disabled" },
    max_tokens: 2000,
    system,
    tools,
    output_config: { effort: "low" },
    messages,
  });
  return { content: response.content, stop_reason: response.stop_reason };
};

/** いまの見立て（即答の層）。見立てだけを返させ、考える量を少なめにして約2秒で返す */
export async function generateQuickFit(system: string, prompt: string): Promise<QuickFitDraft> {
  const response = await getClient().messages.parse({
    model: MODEL_FAST,
    // 打合せの速さに合わせて、考える時間をとらない（文面の質は判定役と検査で守る）
    thinking: { type: "disabled" },
    max_tokens: 1000,
    system,
    output_config: { effort: "low", format: zodOutputFormat(QuickFitSchema) },
    messages: [{ role: "user", content: prompt }],
  });
  return unwrap(response as ParsedResponse<QuickFitDraft>);
}

/** 打合せの後の実務（まとめ・TODO・発注書の下書き）。打合せの後に1回だけ呼ぶので、考える量はふつう */
export async function generatePaperwork(system: string, prompt: string): Promise<PaperworkDraft> {
  const response = await getClient().messages.parse({
    model: MODEL_REASONING,
    max_tokens: 12000,
    system,
    output_config: { effort: "medium", format: zodOutputFormat(PaperworkDraftSchema) },
    messages: [{ role: "user", content: prompt }],
  });
  return unwrap(response as ParsedResponse<PaperworkDraft>);
}

/** 遺族との打合せのロールプレイ：ご遺族役。会話のテンポを優先して考える量は少なめ */
export const hearingFamilyModel: FamilyModel = async (system, messages) => {
  const response = await getClient().messages.parse({
    model: MODEL_FAST,
    // 打合せの速さに合わせて、考える時間をとらない（文面の質は判定役と検査で守る）
    thinking: { type: "disabled" },
    max_tokens: 1500,
    system,
    output_config: { effort: "low", format: zodOutputFormat(FamilyReplySchema) },
    messages,
  });
  return unwrap(response as ParsedResponse<FamilyReply>);
};

/** 遺族との打合せのロールプレイ：判断の取り出し。終わりに1回だけ呼ぶので考える量はふつう */
export const hearingExtractModel: ExtractModel = async (system, prompt) => {
  const response = await getClient().messages.parse({
    model: MODEL_REASONING,
    max_tokens: 6000,
    system,
    output_config: { effort: "medium", format: zodOutputFormat(ExtractionSchema) },
    messages: [{ role: "user", content: prompt }],
  });
  return unwrap(response as ParsedResponse<Extraction>);
};

/** プランの提案（幅ごとの合う・合わない、切り出し方）。推奨と同じく考える量はふつう */
export async function generatePlanFit(system: string, prompt: string): Promise<PlanFitDraft> {
  const response = await getClient().messages.parse({
    model: MODEL_FAST,
    // 打合せの速さに合わせて、考える時間をとらない（文面の質は判定役と検査で守る）
    thinking: { type: "disabled" },
    max_tokens: 4000,
    system,
    output_config: { effort: "low", format: zodOutputFormat(PlanFitDraftSchema) },
    messages: [{ role: "user", content: prompt }],
  });
  return unwrap(response as ParsedResponse<PlanFitDraft>);
}

/** プランの提案を、推奨と同じ判定役で点検する */
export async function judgePlanFit(proposal: PlanFitProposal): Promise<GuardViolation[]> {
  const response = await getClient().messages.parse({
    model: MODEL_REASONING,
    max_tokens: 4000,
    system: `${JUDGE_SYSTEM}\n\n次はプランの提案（3つの幅のうち、どれが合うかと、その切り出し方）です。ご家族の言葉に結びついた具体的な提案は止めません。費用を抑える幅の工夫が添えられているか、格上げを迫っていないかを見てください。`,
    output_config: { effort: "low", format: zodOutputFormat(JudgeSchema) },
    messages: [{ role: "user", content: JSON.stringify(proposal, null, 2) }],
  });
  return unwrap(response as ParsedResponse<z.infer<typeof JudgeSchema>>).violations;
}

/** 話した人の聞き分け（決まりごとで決まらないときだけ）。テンポを優先して Haiku で */
export const classifySpeaker: ClassifySpeaker = async (system, prompt) => {
  const response = await getClient().messages.parse({
    model: MODEL_FAST,
    // 打合せの速さに合わせて、考える時間をとらない（文面の質は判定役と検査で守る）
    thinking: { type: "disabled" },
    max_tokens: 200,
    system,
    output_config: { format: zodOutputFormat(SpeakerAnswerSchema) },
    messages: [{ role: "user", content: prompt }],
  });
  return unwrap(response as ParsedResponse<{ speaker: "staff" | "family" }>);
};
