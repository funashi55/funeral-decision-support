/**
 * 試行回数の制限（固定の時間枠）。合言葉を総当たりで試されないよう、失敗の回数を数える。
 * プロセス内のメモリに置く（デモは1台のサーバーで動かす）。
 */
export interface Limiter {
  /** 制限に達していれば true */
  isBlocked(key: string, now?: number): boolean;
  /** 失敗を1回数える */
  recordFailure(key: string, now?: number): void;
}

export function createLimiter(maxFailures: number, windowMs: number): Limiter {
  const windows = new Map<string, { start: number; count: number }>();
  const current = (key: string, now: number): { start: number; count: number } => {
    const w = windows.get(key);
    if (!w || now - w.start >= windowMs) return { start: now, count: 0 };
    return w;
  };
  return {
    isBlocked: (key, now = Date.now()) => current(key, now).count >= maxFailures,
    recordFailure: (key, now = Date.now()) => {
      const w = current(key, now);
      windows.set(key, { start: w.start, count: w.count + 1 });
    },
  };
}

/** 呼び出し元の識別（配置先のプロキシが付ける転送元アドレス。なければ一律） */
export function clientKey(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
