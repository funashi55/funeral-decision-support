import { describe, expect, test } from "vitest";
import { applyExtraction, confirmDecision, type Extraction } from "./extract";
import { DEMO_CASE } from "./fixtures/demoCase";

const base = { ...DEMO_CASE, circumstances: [], decisions: {}, profile: {} };

const extraction: Extraction = {
  circumstances: [
    { text: "孫が3日後に到着する", utteranceIds: ["U3"] },
    { text: "根拠のない事情", utteranceIds: ["U99"] },
  ],
  candidates: [
    { decisionId: "relatives_arrival", value: "孫が3日後に東京から", utteranceIds: ["U3"] },
    { decisionId: "budget_scope", value: "できるだけ抑えたい", utteranceIds: ["U5"] },
  ],
  profile: { daysUntilFuneral: 6, deceasedAge: null, funeralStyle: "家族葬" },
};

describe("抽出結果の反映", () => {
  test("決定は候補として入り、確定にはならない", () => {
    const next = applyExtraction(base, extraction);
    expect(next.decisions.relatives_arrival).toMatchObject({ status: "candidate", utteranceIds: ["U3"] });
  });

  test("根拠の発言が存在しない事情は捨てる", () => {
    const next = applyExtraction(base, extraction);
    expect(next.circumstances.map((c) => c.text)).toEqual(["孫が3日後に到着する"]);
  });

  test("分からない条件（null）は、既に分かっている値を消さない", () => {
    const next = applyExtraction({ ...base, profile: { deceasedAge: 84 } }, extraction);
    expect(next.profile).toEqual({ deceasedAge: 84, daysUntilFuneral: 6, funeralStyle: "家族葬" });
  });

  test("担当者が確定した決定は、抽出で上書きしない", () => {
    const confirmed = confirmDecision(base, "budget_scope", "葬儀とお墓は別の財布");
    const next = applyExtraction(confirmed, extraction);
    expect(next.decisions.budget_scope).toMatchObject({ status: "confirmed", value: "葬儀とお墓は別の財布" });
  });

  test("元の状態は書き換えない", () => {
    const snapshot = JSON.stringify(base);
    applyExtraction(base, extraction);
    expect(JSON.stringify(base)).toBe(snapshot);
  });
});
