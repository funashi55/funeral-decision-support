import { describe, expect, test } from "vitest";
import { ALTAR_PLANS, RANGE_LABEL, buildEstimate, yen } from "./pricing";

describe("プラン", () => {
  test("3つの幅がそれぞれ1つずつある", () => {
    expect(ALTAR_PLANS.map((p) => p.range).sort()).toEqual(Object.keys(RANGE_LABEL).sort());
  });

  test("どのプランにも「含まれないもの」が書かれている", () => {
    for (const p of ALTAR_PLANS) expect(p.excludes.length).toBeGreaterThan(0);
  });
});

describe("見積もり", () => {
  test("プランだけなら、プランの金額がそのまま合計になる", () => {
    const e = buildEstimate("altar_simple", []);
    expect(e.total).toBe(330_000);
    expect(e.lines).toHaveLength(1);
  });

  test("湯灌と安置料2日を足すと、単価×数量が合計に加わる", () => {
    const e = buildEstimate("altar_standard", [
      { itemId: "yukan", quantity: 1 },
      { itemId: "resting_fee", quantity: 2 },
    ]);
    expect(e.total).toBe(520_000 + 88_000 + 16_500 * 2);
  });

  test("足した品目は「含まれないもの」から消え、足していないものは残る", () => {
    const e = buildEstimate("altar_standard", [{ itemId: "yukan", quantity: 1 }]);
    expect(e.notIncluded).not.toContain("湯灌");
    expect(e.notIncluded).toContain("お布施");
    expect(e.notIncluded).toContain("香典返し");
  });

  test("数量0の品目は明細に出さない", () => {
    const e = buildEstimate("altar_simple", [{ itemId: "yukan", quantity: 0 }]);
    expect(e.lines).toHaveLength(1);
    expect(e.notIncluded).toContain("湯灌");
  });

  test("香典返しは返品できる品目として明細に出る", () => {
    const e = buildEstimate("altar_simple", [{ itemId: "return_gift", quantity: 50 }]);
    expect(e.lines[1]).toMatchObject({ returnable: true, amount: 165_000 });
  });

  test("不正な数量や未定義の品目はエラーになる", () => {
    expect(() => buildEstimate("altar_simple", [{ itemId: "yukan", quantity: -1 }])).toThrow("数量が不正です");
    expect(() => buildEstimate("altar_simple", [{ itemId: "unknown", quantity: 1 }])).toThrow("未定義の品目です");
    expect(() => buildEstimate("unknown", [])).toThrow("未定義のプランです");
  });

  test("円表記", () => {
    expect(yen(330000)).toBe("330,000円");
  });
});
