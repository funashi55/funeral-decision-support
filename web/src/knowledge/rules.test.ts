import { describe, expect, test } from "vitest";
import { loadKnowledge, rulesFor } from "./rules";

describe("ベテランの知見", () => {
  test("すべての知見が形式どおりで、元の発言を持ち、存在する決定項目を指している", () => {
    const k = loadKnowledge();
    expect(k.rules.length).toBeGreaterThanOrEqual(10);
    for (const r of k.rules) expect(r.source.length).toBeGreaterThan(0);
  });

  test("存在しない決定項目を指す知見は読み込みで弾かれる", () => {
    const bad = { version: "x", note: "x", rules: [{ id: "R-x-01", topic: "t", when: "w", do: "d", why: "y", source: "s", origin: "author_memo", decisionIds: ["unknown"] }] };
    expect(() => loadKnowledge(bad)).toThrow("未定義の決定項目です");
  });

  test("お別れの仕方に関わる知見を引ける", () => {
    const ids = rulesFor(loadKnowledge(), ["laying_in_style"]).map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining(["R-farewell-03", "R-farewell-04"]));
  });
});
