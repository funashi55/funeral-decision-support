/**
 * Claude の呼び出し。推奨の生成と判定役は Opus、抽出は Haiku。
 * すべて構造化出力で受け取り、応答を控えた場合と形が崩れた場合は例外にする。
 */
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { MODEL_REASONING, ModelOutputError, ModelRefusedError, getClient } from "./client";
import type { ChatModel } from "./familyChat";
import { FarewellDraftSchema, type FarewellDraft, type FarewellRecommendation } from "./farewell";
import type { GuardRule, GuardViolation } from "./guard";

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
    model: MODEL_REASONING,
    max_tokens: 8000,
    system,
    output_config: { effort: "medium", format: zodOutputFormat(FarewellDraftSchema) },
    messages: [{ role: "user", content: prompt }],
  });
  return unwrap(response as ParsedResponse<FarewellDraft>);
}

const JUDGE_RULES = ["fear_appeal", "majority_pressure", "pressure_language", "no_budget_option", "numbers_in_text"] as const satisfies readonly GuardRule[];

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
止めないもの：できること・できないことの中立な説明、家族の言葉に基づく理由、家族に望むかを尋ねる問い`;

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
    model: MODEL_REASONING,
    max_tokens: 2000,
    system,
    tools,
    output_config: { effort: "low" },
    messages,
  });
  return { content: response.content, stop_reason: response.stop_reason };
};
