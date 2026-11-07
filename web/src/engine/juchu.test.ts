import { describe, expect, it } from "vitest";
import type { CaseState } from "./case";
import { DEMO_CASE } from "./fixtures/demoCase";
import { DEMO_SETTLED } from "./fixtures/demoSettled";
import { buildJuchu } from "./juchu";

const done = (value: string) => ({ value, status: "confirmed" as const, utteranceIds: [] });
const settled: CaseState = { ...DEMO_CASE, decisions: Object.fromEntries(Object.entries(DEMO_SETTLED).map(([k, v]) => [k, done(v)])) };

describe("受注書を、確定した決定と登録から作る", () => {
  it("頭の欄（故人・喪主・式場・安置先・日程・担当者）を埋める", () => {
    const j = buildJuchu(settled, 0);
    expect(j.deceased).toEqual({ name: "山田 ハナ", age: "84歳", sex: "女性" });
    expect(j.mourner).toBe("長女");
    expect(j.venue).toBe("当社 東会館");
    expect(j.restingPlace).toBe("会館の安置室（3日間）");
    expect(j.schedule.death).toBe("11月7日 5時30分");
    expect(j.schedule.wake).toBe("11月10日 18時 当社 東会館");
    expect(j.staffName).toBe("佐藤（2年目）");
  });

  it("プランの定番の一式、祭壇、発注するものを1行ずつ載せ、要らないものは載せない", () => {
    const rows = buildJuchu(settled, 0).ledger;
    const names = rows.map((r) => r.name);
    expect(names).toEqual(expect.arrayContaining(["寝棺一式", "霊柩車", "祭壇（生花祭壇（小））"]));
    expect(rows.find((r) => r.orderId === "return_gifts")?.quantity).toBe("30個");
    expect(rows.find((r) => r.orderId === "taxi")?.quantity).toBe("3台");
    expect(rows.some((r) => r.orderId === "yukan")).toBe(false);
    expect(rows.some((r) => r.orderId === "obituary")).toBe(false);
  });

  it("何も決まっていなければ、わからない欄は要確認のまま", () => {
    const j = buildJuchu({ ...DEMO_CASE, registration: undefined, decisions: {} }, 0);
    expect(j.venue).toBe("要確認");
    expect(j.deceased.name).toBe("");
  });

  it("金額は書かない", () => {
    expect(JSON.stringify(buildJuchu(settled, 0))).not.toMatch(/円/);
  });
});
