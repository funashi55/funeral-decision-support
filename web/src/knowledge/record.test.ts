import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import raw from "../data/decision-evidence.json";
import { getDecision } from "../domain/decisions";
import { evidenceFor, tipsFor } from "../domain/decisionEvidence";
import { checkText } from "../engine/guard";
import { loadKnowledge, loadRecordKnowledge, withRecordRules } from "./rules";

const DENYLIST_PATH = resolve(__dirname, "../../../docs/private/denylist.txt");
const DENYLIST = existsSync(DENYLIST_PATH) ? readFileSync(DENYLIST_PATH, "utf-8").split("\n").map((w) => w.trim()).filter(Boolean) : [];

describe("施行の記録から取り出した知見", () => {
  test("形式が正しく、参照する決定項目がすべてある", () => {
    const record = loadRecordKnowledge();
    expect(record.rules.length).toBeGreaterThan(0);
    expect(record.rules.every((r) => r.origin === "core_record")).toBe(true);
  });

  test("聞き取り・メモの知見に足され、同じ id は先の知見が勝つ", () => {
    const base = loadKnowledge();
    const merged = withRecordRules(base);
    expect(merged.rules.length).toBe(base.rules.length + loadRecordKnowledge().rules.length);
    const first = loadRecordKnowledge().rules[0]!;
    const overridden = withRecordRules({ ...base, rules: [...base.rules, { ...first, do: "上書き" }] });
    expect(overridden.rules.filter((r) => r.id === first.id).map((r) => r.do)).toEqual(["上書き"]);
  });

  test("知見の文章は、守る線（不安・多数派・急かし・上乗せ）にかからない", () => {
    for (const rule of loadRecordKnowledge().rules) {
      const violations = checkText(`${rule.when}は、${rule.do}`).filter((v) => v.rule !== "numbers_in_text");
      expect(violations, rule.id).toEqual([]);
    }
  });
});

describe("決めることボードに添える実績", () => {
  test("どの実績も既存の決定項目についてのもので、30件以上の記録に基づく", () => {
    for (const [id, e] of Object.entries(raw.evidence)) {
      expect(() => getDecision(id)).not.toThrow();
      expect(e.count).toBeGreaterThanOrEqual(raw.minCount);
    }
  });

  test("公開する実績と知見に、社名や施設名を書かない（語の一覧は公開しない docs/private/denylist.txt）", () => {
    const text = JSON.stringify(raw) + JSON.stringify(loadRecordKnowledge());
    for (const word of DENYLIST) expect(text).not.toContain(word);
  });

  test("項目ごとに実績と知見を引ける", () => {
    expect(evidenceFor("temple")?.text).toContain("寺院の記録がない");
    expect(tipsFor("temple").some((r) => r.id === "R-record-04")).toBe(true);
    expect(evidenceFor("parking")).toBeUndefined();
  });
});
