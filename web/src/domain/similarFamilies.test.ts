import { describe, expect, test } from "vitest";
import { ageBand, daysBand, funeralStyleReferences, yukanReferences } from "./similarFamilies";

describe("区分の切り方", () => {
  test.each([
    [2, "3日以内"],
    [3, "3日以内"],
    [4, "4〜5日"],
    [6, "6日以上"],
  ])("葬儀まで%i日は「%s」", (days, band) => expect(daysBand(days)).toBe(band));

  test.each([
    [64, "64歳以下"],
    [65, "65〜79歳"],
    [89, "80〜89歳"],
    [95, "90歳以上"],
  ])("%i歳は「%s」", (age, band) => expect(ageBand(age)).toBe(band));
});

describe("湯灌の参考値", () => {
  test("事情を何も渡さなければ、全体の割合だけを返す", () => {
    const r = yukanReferences({});
    expect(r.references).toHaveLength(1);
    expect(r.references[0].cohort).toBe("すべての家族");
  });

  test("葬儀まで日があく家族ほど、湯灌を選ぶ割合が高い", () => {
    const short = yukanReferences({ daysUntilFuneral: 2 }).references[1];
    const long = yukanReferences({ daysUntilFuneral: 7 }).references[1];
    expect(short.cohort).toBe("葬儀まで3日以内の家族");
    expect(long.percent).toBeGreaterThan(short.percent);
  });

  test("すべての参考値に件数と出典が付く", () => {
    const r = yukanReferences({ daysUntilFuneral: 6, deceasedAge: 88, funeralStyle: "家族葬" });
    expect(r.source).toContain("匿名集計");
    for (const ref of r.references) expect(ref.count).toBeGreaterThanOrEqual(30);
  });
});

describe("葬儀の形の参考値", () => {
  test("故人の年齢から、近い家族の内訳を返す", () => {
    const r = funeralStyleReferences({ deceasedAge: 85 });
    expect(r.references.some((ref) => ref.measure === "家族葬を選んだ割合")).toBe(true);
    expect(r.unavailable).toEqual([]);
  });
});
