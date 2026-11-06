import { describe, expect, test } from "vitest";
import { checkText } from "../engine/guard";
import { GRIEF_PRINCIPLES, getGriefPrinciple } from "./griefCare";

describe("ご遺族への配慮の考え方", () => {
  test("どの考え方にも、出典・かける言葉・避けたい言葉と理由がある", () => {
    for (const p of GRIEF_PRINCIPLES) {
      expect(p.source).toMatch(/\(\d{4}\)/);
      expect(p.sayExamples.length).toBeGreaterThan(0);
      expect(p.avoid.length).toBeGreaterThan(0);
      for (const a of p.avoid) expect(a.why).not.toBe("");
    }
  });

  test("かける言葉の例は、守る線の検査に通る", () => {
    for (const p of GRIEF_PRINCIPLES) for (const words of p.sayExamples) expect(checkText(words), words).toEqual([]);
  });

  test("かける言葉の例は、有料の選択肢や費用に触れない", () => {
    for (const p of GRIEF_PRINCIPLES) for (const words of p.sayExamples) expect(words).not.toMatch(/湯灌|エンバーミング|費用|円|プラン/);
  });

  test("ID の重複はなく、未定義の ID は例外にする", () => {
    expect(new Set(GRIEF_PRINCIPLES.map((p) => p.id)).size).toBe(GRIEF_PRINCIPLES.length);
    expect(() => getGriefPrinciple("stages")).toThrow();
  });
});
