import { describe, expect, test, vi } from "vitest";
import { buildFarewellContext, recommendFarewell, type FarewellDraft } from "./farewell";
import { DEMO_CASE } from "./fixtures/demoCase";

const goodDraft: FarewellDraft = {
  familyWish: "お風呂が好きだったお母さまを清めて送り出し、お孫さんにも顔を見てお別れさせたいと望まれているようです",
  options: [
    { optionId: "standard_laying", fit: "consider", reason: "費用を抑えたいご意向に合います", howToRaise: "身支度を整えてお棺にお納めする形でも、愛用の品を一緒に入れて差し上げられます", utteranceIds: ["U5"], ruleIds: [] },
    { optionId: "yukan", fit: "suits", reason: "お風呂に入りたがっていたお母さまを、ご家族の手で清めて送り出せます", howToRaise: "お風呂がお好きだったとおっしゃっていましたね。納棺の前に、お体を清めて差し上げる形もあります。ご家族も手を添えたいですか", utteranceIds: ["U2"], ruleIds: ["R-farewell-03"] },
    { optionId: "extend_resting", fit: "suits", reason: "お孫さんの到着を待ってから、顔を見てお別れできます", howToRaise: "お孫さんが着かれてから、ゆっくりお顔を見ていただく日取りにもできます", utteranceIds: ["U3", "U4"], ruleIds: ["R-farewell-02"] },
    { optionId: "embalming", fit: "not_now", reason: "日を延ばす方法で、お孫さんのお別れには間に合いそうです", howToRaise: "今回は触れなくてよさそうです", utteranceIds: ["U3"], ruleIds: ["R-farewell-02"] },
  ],
  referenceIds: ["REF-1", "REF-2"],
  timeAdvice: "火葬を急がず、お孫さんが着いてから納棺と湯灌を行う流れを提案できます",
  questionsToAsk: ["湯灌のとき、ご家族も手を添えたいですか", "お孫さんの到着の時刻は分かりますか"],
  griefCare: [{ principleId: "continuing_bonds", observation: "お母さまのお風呂好きを繰り返し話されているようです", words: "お母さまは、お風呂の時間を大事にされていたのですね", utteranceIds: ["U2"] }],
  cautions: [{ decisionId: "cremation_date", message: "お寺と斎場の都合を確認してから火葬の日時を確定してください" }],
};

describe("材料の組み立て", () => {
  test("発言・知見・参考値に ID が振られ、数字は材料に入らない", () => {
    const ctx = buildFarewellContext(DEMO_CASE);
    expect(ctx.prompt).toContain("[U2]");
    expect(ctx.prompt).toContain("[R-farewell-03]");
    expect(ctx.prompt).toContain("[REF-2] 葬儀まで6日以上の家族・湯灌を選んだ割合");
    expect(ctx.prompt).not.toMatch(/\d+(?:\.\d)?%/);
  });
});

describe("お別れの仕方の推奨", () => {
  test("守る線を外していない案は、金額と割合を差し込んで返す", async () => {
    const judge = vi.fn().mockResolvedValue([]);
    const result = await recommendFarewell(DEMO_CASE, async () => goodDraft, judge);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const yukan = result.recommendation.options.find((o) => o.id === "yukan");
    expect(yukan?.price?.amount).toBe(88_000);
    expect(result.recommendation.options.find((o) => o.id === "standard_laying")?.price).toBeNull();
    expect(result.recommendation.references[1]).toMatchObject({ cohort: "葬儀まで6日以上の家族", percent: 22.2 });
    expect(result.recommendation.options[0].fit).toBe("suits");
    expect(judge).toHaveBeenCalledTimes(1);
  });

  test("不安をあおる案は出し直させ、指摘を次の材料に添える", async () => {
    const bad: FarewellDraft = { ...goodDraft, timeAdvice: "日が経つと菌が増えるので湯灌が安心です" };
    const generate = vi.fn().mockResolvedValueOnce(bad).mockResolvedValueOnce(goodDraft);
    const result = await recommendFarewell(DEMO_CASE, generate, async () => []);
    expect(result).toMatchObject({ ok: true, attempts: 2 });
    expect(generate.mock.calls[1][1]).toContain("不安をあおる言い回し「菌」");
  });

  test("2回とも守る線を外したら、推奨を出さない", async () => {
    const bad: FarewellDraft = { ...goodDraft, familyWish: "88,000円で湯灌ができます" };
    const result = await recommendFarewell(DEMO_CASE, async () => bad, async () => []);
    expect(result.ok).toBe(false);
  });

  test("費用のかからない通常の納棺を外した案は止める", async () => {
    const noBudget: FarewellDraft = {
      ...goodDraft,
      options: goodDraft.options.map((o) => (o.optionId === "standard_laying" ? { ...o, fit: "not_now" as const } : o)),
    };
    const result = await recommendFarewell(DEMO_CASE, async () => noBudget, async () => []);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.violations.map((v) => v.rule)).toContain("no_budget_option");
  });

  test("材料にない発言 ID を作った案は止める", async () => {
    const invented: FarewellDraft = { ...goodDraft, options: [{ ...goodDraft.options[0], utteranceIds: ["U99"] }, ...goodDraft.options.slice(1)] };
    const result = await recommendFarewell(DEMO_CASE, async () => invented, async () => []);
    expect(result.ok).toBe(false);
  });

  test("判定役が止めた案も出さない", async () => {
    const result = await recommendFarewell(DEMO_CASE, async () => goodDraft, async () => [{ rule: "pressure_language", message: "断りづらい" }]);
    expect(result).toMatchObject({ ok: false, attempts: 2 });
  });

  test("推奨を出せないときは、モデルの文章を含まない事実だけを、費用のかからないものから返す", async () => {
    const result = await recommendFarewell(DEMO_CASE, async () => goodDraft, async () => [{ rule: "fear_appeal", message: "止めた" }]);
    if (result.ok) throw new Error("推奨が出てしまった");
    expect(result.facts.map((f) => f.id)).toEqual(expect.arrayContaining(["standard_laying", "yukan", "embalming", "extend_resting"]));
    expect(result.facts[0]?.price).toBeNull();
    const json = JSON.stringify(result.facts);
    for (const o of goodDraft.options) expect(json).not.toContain(o.reason);
  });

  test("切り出し方とご遺族への配慮を、そのまま担当者向けに返す", async () => {
    const result = await recommendFarewell(DEMO_CASE, async () => goodDraft, async () => []);
    if (!result.ok) throw new Error("推奨が出なかった");
    expect(result.recommendation.options.find((o) => o.id === "yukan")?.howToRaise).toContain("手を添えたいですか");
    expect(result.recommendation.griefCare[0]).toMatchObject({ principleId: "continuing_bonds", utteranceIds: ["U2"] });
  });

  test("配慮の言葉で有料の選択肢に触れた案は止める（気持ちへの配慮を販売の理由にしない）", async () => {
    const selling: FarewellDraft = { ...goodDraft, griefCare: [{ ...goodDraft.griefCare[0], words: "お母さまのために、湯灌でさっぱりさせて差し上げましょう" }] };
    const result = await recommendFarewell(DEMO_CASE, async () => selling, async () => []);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.violations.map((v) => v.rule)).toContain("upsell");
  });

  test("切り出し方で後悔を先回りする案は止める", async () => {
    const pushing: FarewellDraft = {
      ...goodDraft,
      options: goodDraft.options.map((o) => (o.optionId === "yukan" ? { ...o, howToRaise: "やっておかないと後悔しますよ" } : o)),
    };
    const result = await recommendFarewell(DEMO_CASE, async () => pushing, async () => []);
    expect(result.ok).toBe(false);
  });

  test("配慮の考え方は、材料に ID・考え方・避けたい言葉が入る", () => {
    const ctx = buildFarewellContext(DEMO_CASE);
    expect(ctx.prompt).toContain("[continuing_bonds]");
    expect(ctx.prompt).toContain("避けたい言葉");
  });
});
