import { describe, expect, it } from "vitest";
import type { CaseState, Utterance } from "./case";
import { DEMO_CASE } from "./fixtures/demoCase";
import { buildPlanFitPrompt, familyAskedForMore, familyWantsToSave, recommendPlanFit, stripIds, validatePlanFit, type PlanFitDraft } from "./planFit";

const say = (id: string, text: string, speaker: Utterance["speaker"] = "chief_mourner"): Utterance => ({ id, speaker, speakerLabel: speaker === "staff" ? "担当者" : "喪主", text, at: 0 });
const withLines = (...lines: Utterance[]): CaseState => ({ ...DEMO_CASE, utterances: lines, circumstances: [], decisions: {} });

const draft = (over: Partial<PlanFitDraft> = {}): PlanFitDraft => ({
  bestRange: "simple",
  ranges: [
    { range: "simple", fitsBecause: "お好きなお花を一輪添えられます", watchOut: "", utteranceIds: ["U1"] },
    { range: "standard", fitsBecause: "", watchOut: "飾りの量はご家族と確かめたい", utteranceIds: [] },
    { range: "gratitude", fitsBecause: "", watchOut: "", utteranceIds: [] },
  ],
  howToRaise: "お花がお好きだったと伺いましたので、お好きなお花を中心にお飾りする形もございます",
  budgetAlternative: "費用を抑える形でも、お好きなお花を一輪添えることはできます",
  closingQuestion: "どのような形がお母さまらしいか、ご家族で感じられることを教えてください",
  ...over,
});

describe("ご家族の言葉から読むこと", () => {
  it("費用を抑えたい気持ちは、ご家族の発言だけから読む", () => {
    expect(familyWantsToSave(withLines(say("U1", "費用はできるだけ抑えたいんですけど")))).toBe(true);
    expect(familyWantsToSave(withLines(say("U1", "費用を抑えたい方もいらっしゃいます", "staff")))).toBe(false);
  });

  it("上の幅を自分から尋ねているかを読む", () => {
    expect(familyAskedForMore(withLines(say("U1", "母には華やかに送ってあげたい")))).toBe(true);
    expect(familyAskedForMore(withLines(say("U1", "家族だけで送りたいです")))).toBe(false);
  });

  it("指示に、費用を抑えたいかどうかと、金額を書かない約束が入る", () => {
    const prompt = buildPlanFitPrompt(withLines(say("U1", "費用はできるだけ抑えたい")));
    expect(prompt).toContain("費用を抑えたいと話しているか：はい");
    expect(prompt).not.toMatch(/[0-9]{3},[0-9]{3}/);
  });
});

describe("止める線", () => {
  const saving = withLines(say("U1", "庭の花の手入れを毎朝していました"), say("U2", "費用はできるだけ抑えたいんですけど"));

  it("費用を抑えたいご家族に、上の幅をいちばん合うとしない", () => {
    expect(validatePlanFit(draft({ bestRange: "gratitude" }), saving).map((v) => v.rule)).toContain("no_budget_option");
  });

  it("ご家族が自分から華やかにと言っていれば、上の幅を合うとしてよい", () => {
    const asked = withLines(say("U1", "費用は抑えたいけど、母は華やかなのが好きだった"));
    expect(validatePlanFit(draft({ bestRange: "gratitude" }), asked)).toEqual([]);
  });

  it("費用を抑える工夫が書かれていなければ止める", () => {
    expect(validatePlanFit(draft({ budgetAlternative: "" }), saving).map((v) => v.rule)).toContain("no_budget_option");
  });

  it("後悔や多数派、格上げの言い回しを止める", () => {
    const rules = validatePlanFit(draft({ howToRaise: "最後ですから、皆さん選ばれている上のプランにグレードアップしましょう" }), saving).map((v) => v.rule);
    expect(rules).toEqual(expect.arrayContaining(["pressure_language", "majority_pressure", "upsell"]));
  });

  it("金額を文章に書いたら止める", () => {
    expect(validatePlanFit(draft({ budgetAlternative: "33万円で収まります" }), saving).map((v) => v.rule)).toContain("numbers_in_text");
  });

  it("根拠は、ご家族の実際の発言に限る", () => {
    const staffLine = withLines(say("U1", "お花はお好きでしたか", "staff"));
    expect(validatePlanFit(draft(), staffLine).map((v) => v.rule)).toContain("unknown_reference");
  });
});

describe("作って、検査して、だめなら1回だけ作り直す", () => {
  const state = withLines(say("U1", "庭の花の手入れを毎朝していました"), say("U2", "費用はできるだけ抑えたいんですけど"));

  it("1回目が止められても、直した案が通れば出す。並びは費用を抑える順", async () => {
    const drafts = [draft({ bestRange: "standard" }), draft({ ranges: [...draft().ranges].reverse() })];
    const result = await recommendPlanFit(state, async () => drafts.shift()!, async () => []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.attempts).toBe(2);
    expect(result.proposal.ranges.map((r) => r.range)).toEqual(["simple", "standard", "gratitude"]);
    expect(result.proposal.planIdByRange.simple).toBeTruthy();
  });

  it("判定役が2回とも止めたら出さない", async () => {
    const result = await recommendPlanFit(state, async () => draft(), async () => [{ rule: "upsell", message: "格上げを勧めています" }]);
    expect(result.ok).toBe(false);
  });
});

describe("読みやすさ", () => {
  it("文章に紛れ込んだ発言の ID を消す", () => {
    expect(stripIds("費用を抑えたいお気持ち（U18）と、家族葬（U11）に合います")).toBe("費用を抑えたいお気持ちと、家族葬に合います");
    expect(stripIds("ご到着を待つ日程（U12・U17）と合うか")).toBe("ご到着を待つ日程と合うか");
  });
});
