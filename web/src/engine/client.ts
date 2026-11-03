import Anthropic from "@anthropic-ai/sdk";

/** 推奨・判定・画像の検品に使う。判断の質が作品の芯なので Opus を使う */
export const MODEL_REASONING = "claude-opus-5-5";
/** 打合せのテンポに合わせた抽出に使う */
export const MODEL_FAST = "claude-haiku-5-5";

let client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (client) return client;
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY が設定されていません。web/.env.local に設定してください");
  }
  client = new Anthropic();
  return client;
}

export class ModelRefusedError extends Error {
  constructor(readonly category: string | null) {
    super(`モデルが応答を控えました（${category ?? "理由不明"}）`);
  }
}

export class ModelOutputError extends Error {}
