import { describe, expect, it } from "vitest";
import catalog from "./product-catalog.json";

describe("商品とプランの価格表（集計値）", () => {
  it("30件以上の品目だけを持ち、単価は500円単位に丸めてある", () => {
    for (const item of catalog.items) {
      expect(item.count).toBeGreaterThanOrEqual(catalog.minCount);
      expect(item.memberPrice % 500).toBe(0);
      expect(item.generalPrice % 500).toBe(0);
    }
  });

  it("持つのは品目・単価・件数だけ（商品名・会場名・人の名前などの欄はない）", () => {
    const keys = new Set(catalog.items.flatMap((i) => Object.keys(i)));
    expect([...keys].sort()).toEqual(["count", "generalPrice", "id", "label", "memberPrice", "unit"]);
    expect(Object.keys(catalog.altar).sort()).toEqual(["count", "large", "medium", "small"]);
  });
});
