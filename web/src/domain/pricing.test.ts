import { describe, expect, test } from "vitest";
import catalog from "../data/product-catalog.json";
import { ALTAR_PLANS, CATALOG, RANGE_LABEL, buildEstimate, getCatalogItem, getPlan, yen } from "./pricing";

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
    expect(e.total).toBe(getPlan("altar_simple").price);
    expect(e.lines).toHaveLength(1);
  });

  test("湯灌と安置料2日を足すと、単価×数量が合計に加わる", () => {
    const e = buildEstimate("altar_standard", [
      { itemId: "yukan", quantity: 1 },
      { itemId: "resting_fee", quantity: 2 },
    ]);
    expect(e.total).toBe(getPlan("altar_standard").price + getCatalogItem("yukan").unitPrice + getCatalogItem("resting_fee").unitPrice * 2);
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
    expect(e.lines[1]).toMatchObject({ returnable: true, amount: getCatalogItem("return_gift").unitPrice * 50 });
  });

  test("不正な数量や未定義の品目はエラーになる", () => {
    expect(() => buildEstimate("altar_simple", [{ itemId: "yukan", quantity: -1 }])).toThrow("数量が不正です");
    expect(() => buildEstimate("altar_simple", [{ itemId: "unknown", quantity: 1 }])).toThrow("未定義の品目です");
    expect(() => buildEstimate("unknown", [])).toThrow("未定義のプランです");
  });

  test("一般価格では、プランの一式が一般の価格になる", () => {
    expect(buildEstimate("altar_simple", [], "general").total).toBe(getPlan("altar_simple").generalPrice);
    expect(getPlan("altar_simple").generalPrice).toBeGreaterThan(getPlan("altar_simple").price);
  });

  test("価格表は集計の JSON から読み、祭壇の価格は小・中・大の順に上がる", () => {
    expect(CATALOG.length).toBe(catalog.items.length);
    const [s, m, l] = ALTAR_PLANS.map((p) => p.price);
    expect(s! < m! && m! < l!).toBe(true);
    for (const item of CATALOG) expect(item.unitPrice % 500).toBe(0);
  });

  test("円表記", () => {
    expect(yen(330000)).toBe("330,000円");
  });
});
