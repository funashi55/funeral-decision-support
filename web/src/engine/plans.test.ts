import { describe, expect, test } from "vitest";
import { buildEstimate, getCatalogItem, getPlan } from "../domain/pricing";
import type { CaseState } from "./case";
import { DEMO_CASE } from "./fixtures/demoCase";
import { buildPlanProposals, readCount } from "./plans";

const decided = (decisions: Record<string, string>, profile: CaseState["profile"] = DEMO_CASE.profile): CaseState => ({
  ...DEMO_CASE,
  profile,
  decisions: Object.fromEntries(Object.entries(decisions).map(([k, v]) => [k, { value: v, status: "confirmed" as const, utteranceIds: [] }])),
});

describe("3つの幅での案", () => {
  test("費用を抑える案から順に並ぶ", () => {
    const ranges = buildPlanProposals(DEMO_CASE).map((p) => p.range);
    expect(ranges).toEqual(["simple", "standard", "gratitude"]);
  });

  test("案の金額は、すべて価格表から計算した値と一致する", () => {
    const s = decided({ laying_in_style: "湯灌", attendees_scope: "15名ほど" });
    for (const p of buildPlanProposals(s)) {
      const sum = p.estimate.lines.reduce((acc, l) => acc + l.unitPrice * l.quantity, 0);
      expect(p.estimate.total).toBe(sum);
      expect(p.estimate.lines[0]?.unitPrice).toBe(getPlan(p.planId).price);
    }
  });

  test("火葬まで6日なら、含まれる日数を超えた分のドライアイスと安置料を足す", () => {
    const [simple, standard] = buildPlanProposals(DEMO_CASE);
    const iceOf = (p: typeof simple) => p!.estimate.lines.find((l) => l.label === getCatalogItem("dry_ice").label)?.quantity;
    expect(iceOf(simple)).toBe(4);
    expect(iceOf(standard)).toBe(3);
  });

  test("自宅で安置するなら、安置料を足さない", () => {
    const [simple] = buildPlanProposals(decided({ resting_place: "自宅" }));
    expect(simple!.estimate.lines.some((l) => l.label === getCatalogItem("resting_fee").label)).toBe(false);
  });

  test("湯灌を選んだら足し、含まれないものから湯灌が消える", () => {
    const [simple] = buildPlanProposals(decided({ laying_in_style: "湯灌を行う" }));
    expect(simple!.estimate.lines.some((l) => l.unitPrice === 88_000)).toBe(true);
    expect(simple!.estimate.notIncluded).not.toContain("湯灌");
  });

  test("人数が決まっていなければ、会食と香典返しは金額に入れず「人数が決まってから」と示す", () => {
    const [simple] = buildPlanProposals(DEMO_CASE);
    expect(simple!.pendingCounts).toEqual(["会食（人数が決まってから）", "香典返し（人数が決まってから）"]);
    expect(simple!.estimate.notIncluded).toContain("料理");
  });

  test("人数が分かれば、会食と香典返しを人数分足す", () => {
    const [simple] = buildPlanProposals(decided({ attendees_scope: "15名ほど" }));
    const expected = buildEstimate("altar_simple", [
      { itemId: "dry_ice", quantity: 4 },
      { itemId: "resting_fee", quantity: 4 },
      { itemId: "hall_fee", quantity: 1 },
      { itemId: "meal", quantity: 15 },
      { itemId: "return_gift", quantity: 15 },
    ]);
    expect(simple!.estimate.total).toBe(expected.total);
    expect(simple!.pendingCounts).toEqual([]);
  });

  test("火葬式なら会場使用料を足さない", () => {
    const [simple] = buildPlanProposals(decided({}, { funeralStyle: "火葬式", daysUntilFuneral: 2 }));
    expect(simple!.estimate.lines.map((l) => l.label)).toEqual([getPlan("altar_simple").label]);
  });

  test("人数を読む", () => {
    expect(readCount("15名ほど")).toBe(15);
    expect(readCount("30人くらい")).toBe(30);
    expect(readCount("家族だけ")).toBeNull();
    expect(readCount(undefined)).toBeNull();
  });
});
