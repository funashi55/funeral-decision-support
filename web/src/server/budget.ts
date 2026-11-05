/**
 * AI を呼ぶ回数の上限。公開して試してもらうときに、料金が想定を超えないよう止める。
 * 1日（日本時間）全体の上限と、1人（転送元アドレス）あたり1時間の上限の2段で数える。
 * 数は kv.ts に置くので、サーバーが何台あっても同じ数を見る。
 */
import { fail } from "./http";
import { getKv, type Kv } from "./kv";
import { clientKey } from "./rateLimit";

export const DEFAULT_DAILY_LIMIT = 600;
export const DEFAULT_HOURLY_PER_CLIENT = 80;

const HOUR_MS = 60 * 60 * 1000;
const JST_OFFSET_MS = 9 * HOUR_MS;

function limitFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export interface BudgetLimits {
  readonly daily: number;
  readonly hourlyPerClient: number;
}

export function limitsFromEnv(): BudgetLimits {
  return {
    daily: limitFromEnv("AI_DAILY_LIMIT", DEFAULT_DAILY_LIMIT),
    hourlyPerClient: limitFromEnv("AI_HOURLY_PER_CLIENT", DEFAULT_HOURLY_PER_CLIENT),
  };
}

/** 上限に達していなければ1回分を数えて null、達していれば断りの応答を返す */
export async function spendAiCall(req: Request, kv: Kv = getKv(), limits: BudgetLimits = limitsFromEnv(), now = Date.now()): Promise<Response | null> {
  const day = new Date(now + JST_OFFSET_MS).toISOString().slice(0, 10);
  const hour = Math.floor(now / HOUR_MS);
  const daily = await kv.incr(`budget:day:${day}`, 60 * 60 * 48);
  if (daily > limits.daily) return fail("今日の試用の上限に達しました。明日もう一度お試しください", 429);
  const mine = await kv.incr(`budget:client:${clientKey(req)}:${hour}`, 60 * 60 * 2);
  if (mine > limits.hourlyPerClient) return fail("短い時間に続けて使われたため、少し止めています。しばらくしてからお試しください", 429);
  return null;
}
