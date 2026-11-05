import { describe, expect, test } from "vitest";
import { SCENES } from "./judgment-scenes";
import { applyVeteranAnswers, pickSubmission, type Submission } from "./veteranAnswers";

const all = { standard_laying: "suits", yukan: "consider", embalming: "not_now", extend_resting: "consider" } as const;

describe("ベテランの答えへの差し替え", () => {
  test("同じ人が何度か送ったら、最後に送ったものを使う", () => {
    const subs: Submission[] = [
      { respondent: "A", at: 1, scenes: {} },
      { respondent: "B", at: 2, scenes: {} },
      { respondent: "A", at: 3, scenes: { J01: { fits: all } } },
    ];
    expect(pickSubmission(subs)?.at).toBe(3);
    expect(pickSubmission(subs, "B")?.at).toBe(2);
    expect(pickSubmission(subs, "C")).toBeUndefined();
  });

  test("4つすべてに答えた場面だけを差し替える", () => {
    const scenes = applyVeteranAnswers(SCENES, {
      respondent: "A",
      at: 1,
      scenes: { J01: { fits: all }, J02: { fits: { yukan: "suits" } } },
    });
    expect(scenes[0]).toMatchObject({ id: "J01", answer: all, answeredBy: "veteran" });
    expect(scenes[1]).toEqual(SCENES[1]);
  });

  test("答えがなければ仮の答えのまま", () => {
    expect(applyVeteranAnswers(SCENES, undefined)).toEqual([...SCENES]);
  });
});
