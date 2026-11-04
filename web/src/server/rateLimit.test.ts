import { describe, expect, test } from "vitest";
import { clientKey, createLimiter } from "./rateLimit";

describe("試行回数の制限", () => {
  test("失敗が上限に達すると止め、時間枠が過ぎると戻る", () => {
    const l = createLimiter(3, 1000);
    for (let i = 0; i < 3; i++) {
      expect(l.isBlocked("a", 0)).toBe(false);
      l.recordFailure("a", 0);
    }
    expect(l.isBlocked("a", 500)).toBe(true);
    expect(l.isBlocked("b", 500)).toBe(false);
    expect(l.isBlocked("a", 1000)).toBe(false);
  });

  test("転送元アドレスの先頭を呼び出し元とみなす", () => {
    expect(clientKey(new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } }))).toBe("1.2.3.4");
    expect(clientKey(new Request("http://x"))).toBe("local");
  });
});
