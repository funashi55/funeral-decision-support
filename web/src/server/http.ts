import { ZodError } from "zod";
import { ModelOutputError, ModelRefusedError } from "../engine/client";
import { RequestError } from "../engine/requests";

export interface ApiResponse<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
}

export function ok<T>(data: T, status = 200): Response {
  return Response.json({ success: true, data } satisfies ApiResponse<T>, { status });
}

export function fail(error: string, status: number): Response {
  return Response.json({ success: false, error } satisfies ApiResponse<never>, { status });
}

/** 例外を利用者向けの言葉に変える。内部の詳細はサーバーのログにだけ残す */
export function handleError(error: unknown): Response {
  if (error instanceof ZodError) return fail("入力の形式が正しくありません", 400);
  if (error instanceof RequestError) return fail(error.message, 400);
  if (error instanceof ModelRefusedError) return fail("AI が応答を控えました。言い回しを変えて、もう一度お試しください", 422);
  if (error instanceof ModelOutputError) return fail("AI の応答を読み取れませんでした。もう一度お試しください", 502);
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("ANTHROPIC_API_KEY")) return fail("AI の設定がまだ済んでいません（API キー未設定）", 503);
  process.stderr.write(`[api] ${message}\n`);
  return fail("処理中に問題が起きました。もう一度お試しください", 500);
}
