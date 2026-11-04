/**
 * 遺族の窓口の合言葉から案件を引く。失効したリンクは使えない。
 * 間違った合言葉を続けて試した呼び出し元は、しばらく止める。
 */
import { randomBytes } from "node:crypto";
import type { CaseState } from "../engine/case";
import { fail } from "./http";
import { clientKey, createLimiter } from "./rateLimit";
import { store } from "./store";

export const FAMILY_MAX_FAILURES = 10;
export const FAMILY_WINDOW_MS = 10 * 60 * 1000;

const globalForLimiter = globalThis as unknown as { __familyLimiter?: ReturnType<typeof createLimiter> };
const limiter = globalForLimiter.__familyLimiter ?? createLimiter(FAMILY_MAX_FAILURES, FAMILY_WINDOW_MS);
globalForLimiter.__familyLimiter = limiter;

export const NOT_AVAILABLE = "このリンクは使えません。担当者にお問い合わせください";

export function resolveFamily(req: Request, token: string): CaseState | Response {
  const key = clientKey(req);
  if (limiter.isBlocked(key)) return fail("しばらく時間をおいてから、もう一度お試しください", 429);
  const state = store.findByToken(token);
  if (!state || state.familyLinkRevoked) {
    limiter.recordFailure(key);
    return fail(NOT_AVAILABLE, 404);
  }
  return state;
}

/** 推測されにくい合言葉（家名は入れない） */
export function newFamilyToken(): string {
  return randomBytes(12).toString("base64url");
}

