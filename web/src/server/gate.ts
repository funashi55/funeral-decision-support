import { createLimiter, type Limiter } from "./rateLimit";

/** 入口の合言葉を続けて間違えた呼び出し元を、しばらく止める */
const GATE_MAX_FAILURES = 8;
const GATE_WINDOW_MS = 10 * 60 * 1000;

const globalForGate = globalThis as unknown as { __gateLimiter?: Limiter };
export const gateLimiter: Limiter = globalForGate.__gateLimiter ?? createLimiter(GATE_MAX_FAILURES, GATE_WINDOW_MS);
globalForGate.__gateLimiter = gateLimiter;
