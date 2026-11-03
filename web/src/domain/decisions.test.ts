import { describe, expect, test } from "vitest";
import { DECISIONS, blockersOf, decisionOrder, getDecision, impactedBy } from "./decisions";

describe("決定項目の定義", () => {
  test("打合せの決定項目は41項目ある", () => {
    expect(DECISIONS).toHaveLength(41);
  });

  test("id が重複していない", () => {
    const ids = DECISIONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("依存先はすべて定義済みの項目を指している", () => {
    for (const d of DECISIONS) {
      for (const dep of d.dependsOn) {
        expect(() => getDecision(dep), `${d.id} → ${dep}`).not.toThrow();
      }
    }
  });
});

describe("決める順番", () => {
  test("どの項目も、依存先より後に並ぶ（循環がない）", () => {
    const order = decisionOrder().map((d) => d.id);
    expect(order).toHaveLength(DECISIONS.length);
    for (const d of DECISIONS) {
      for (const dep of d.dependsOn) {
        expect(order.indexOf(dep)).toBeLessThan(order.indexOf(d.id));
      }
    }
  });
});

describe("影響の伝わり方", () => {
  test("火葬の日時が変わると、通夜・葬儀・納棺・安置・お悔やみ欄・受付まで見直しになる", () => {
    const ids = impactedBy("cremation_date").map((d) => d.id);
    expect(ids).toEqual(
      expect.arrayContaining(["wake_date", "funeral_date", "laying_in_date", "embalming", "resting_place", "obituary", "reception_desk"]),
    );
  });

  test("火葬の日時が変わっても、その前提である寺は影響を受けない", () => {
    const ids = impactedBy("cremation_date").map((d) => d.id);
    expect(ids).not.toContain("temple");
    expect(ids).not.toContain("cremation_date");
  });

  test("参列の範囲が変わると、料理と香典返しが見直しになる", () => {
    const ids = impactedBy("attendees_scope").map((d) => d.id);
    expect(ids).toEqual(expect.arrayContaining(["meals", "return_gifts", "funeral_style"]));
  });

  test("影響を受ける項目は、決める順番に並んでいる", () => {
    const order = decisionOrder().map((d) => d.id);
    const ids = impactedBy("religion").map((d) => d.id);
    const positions = ids.map((id) => order.indexOf(id));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  test("未定義の項目を渡すと分かりやすいエラーになる", () => {
    expect(() => impactedBy("unknown")).toThrow("未定義の決定項目です");
  });
});

describe("まだ決められない理由", () => {
  test("寺と親族の到着が決まるまで、火葬の日時は決められない", () => {
    const blockers = blockersOf("cremation_date", new Set(["temple"])).map((d) => d.id);
    expect(blockers).toEqual(["relatives_arrival"]);
  });

  test("前提がすべて決まっていれば、妨げはない", () => {
    expect(blockersOf("cremation_date", new Set(["temple", "relatives_arrival"]))).toEqual([]);
  });
});
