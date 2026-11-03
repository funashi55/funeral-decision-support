import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import data from "./similar-families.json";

// 実在の社名などの禁止語は公開しないため、非公開フォルダの一覧から読む（無い環境ではこの検査を飛ばす）
const DENYLIST_PATH = resolve(__dirname, "../../../docs/private/denylist.txt");
const DENYLIST = existsSync(DENYLIST_PATH)
  ? readFileSync(DENYLIST_PATH, "utf-8").split("\n").map((w) => w.trim()).filter(Boolean)
  : [];

const PII_PATTERNS = [/故人名/, /喪主名/, /住所/, /電話/, /execution_no/i, /施行No/, /\d{3}-?\d{4}-?\d{4}/];

describe("似た家族の選び方の集計表", () => {
  test("個人を特定できる項目名や値が含まれていない", () => {
    const text = JSON.stringify(data);
    for (const p of PII_PATTERNS) expect(text, String(p)).not.toMatch(p);
  });

  test.skipIf(DENYLIST.length === 0)("非公開の禁止語（実在の社名など）が含まれていない", () => {
    const text = JSON.stringify(data).toLowerCase();
    for (const word of DENYLIST) expect(text.includes(word.toLowerCase()), "禁止語が含まれています").toBe(false);
  });

  test("どの区分も最小件数以上の家族から集計されている", () => {
    const groups = [
      ...data.yukan.byDaysUntilFuneral,
      ...data.yukan.byAge,
      ...data.yukan.byStyle,
      ...data.funeralStyle.byAge,
      ...data.funeralStyle.byMembership,
    ];
    expect(groups.length).toBeGreaterThan(0);
    for (const g of groups) expect(g.count, g.group).toBeGreaterThanOrEqual(data.minCount);
  });

  test("割合は0〜100の範囲に収まっている", () => {
    for (const g of [...data.yukan.byDaysUntilFuneral, ...data.yukan.byAge, ...data.yukan.byStyle]) {
      expect(g.percent).toBeGreaterThanOrEqual(0);
      expect(g.percent).toBeLessThanOrEqual(100);
    }
  });
});
