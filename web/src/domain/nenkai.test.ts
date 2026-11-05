import { describe, expect, test } from "vitest";
import { buildNenkai, formatJa } from "./nenkai";

const dateOf = (rows: readonly { name: string; date: string }[], name: string): string | undefined => rows.find((r) => r.name === name)?.date;

describe("年回表", () => {
  test("亡くなった日を1日目として、初七日と四十九日・百か日を数える", () => {
    const t = buildNenkai("2026-11-05");
    expect(dateOf(t.chuin, "初七日")).toBe("2026-11-11");
    expect(dateOf(t.chuin, "五七日")).toBe("2026-12-09");
    expect(dateOf(t.chuin, "七七日")).toBe("2026-12-23");
    expect(dateOf(t.chuin, "百か日")).toBe("2027-02-12");
  });

  test("年忌は一周忌が1年後、三回忌が2年後、三十三回忌が32年後", () => {
    const t = buildNenkai("2026-11-05");
    expect(dateOf(t.nenki, "一周忌")).toBe("2027-11-05");
    expect(dateOf(t.nenki, "三回忌")).toBe("2028-11-05");
    expect(dateOf(t.nenki, "七回忌")).toBe("2032-11-05");
    expect(dateOf(t.nenki, "三十三回忌")).toBe("2058-11-05");
  });

  test("月末や年をまたいでも正しく数える", () => {
    expect(dateOf(buildNenkai("2026-12-28").chuin, "初七日")).toBe("2027-01-03");
    expect(dateOf(buildNenkai("2028-02-25").chuin, "初七日")).toBe("2028-03-02");
  });

  test("2月29日に亡くなった方の年忌は、うるう年でない年は2月28日", () => {
    const t = buildNenkai("2028-02-29");
    expect(dateOf(t.nenki, "一周忌")).toBe("2029-02-28");
    expect(dateOf(t.nenki, "七回忌")).toBe("2034-02-28");
  });

  test("四十九日が3つの月にまたがるかを知らせる（三月越し）", () => {
    expect(buildNenkai("2026-11-20").spansThreeMonths).toBe(true);
    expect(buildNenkai("2026-11-05").spansThreeMonths).toBe(false);
  });

  test("ない日付や形の違う日付は受け付けない", () => {
    expect(() => buildNenkai("2026-02-30")).toThrow();
    expect(() => buildNenkai("2026/11/05")).toThrow();
  });

  test("曜日つきの西暦と、和暦の年で表す", () => {
    expect(formatJa("2026-11-11")).toEqual({ western: "2026年11月11日（水）", japanese: "令和8年" });
  });
});
