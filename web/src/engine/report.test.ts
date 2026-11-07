import { describe, expect, it, vi } from "vitest";
import type { CaseState, Utterance } from "./case";
import { DEMO_CASE } from "./fixtures/demoCase";
import { CLEAN_CHUNK, applyCleaned, buildReport, previousMeetingsPrompt, type CleanModel, type ReportModel } from "./report";

const u = (id: string, text: string, speaker: Utterance["speaker"] = "family"): Utterance => ({ id, text, speaker, speakerLabel: speaker === "staff" ? "担当者" : "喪主", at: 0 });

const state = (utterances: Utterance[], decisions: CaseState["decisions"] = {}): CaseState => ({ ...DEMO_CASE, utterances, decisions });

const summarize: ReportModel = async () => ({ overview: " 母の思い出を伺った。 ", familyVoice: [{ text: "家で過ごしたい", utteranceIds: ["u1", "zzz"] }], toDecide: ["日程"], familyResearch: ["親戚の連絡先を確かめていただく"], familyPrepare: ["遺影の写真", "遺影の写真"], staffTasks: ["お寺に連絡"] });
const echoClean: CleanModel = async (_s, prompt) => ({
  lines: prompt.split("\n").map((l) => {
    const m = /^\[(.+?)\] .+?：(.*)$/.exec(l);
    return { id: m?.[1] ?? "", text: (m?.[2] ?? "").replace("えー、", "") };
  }),
});

describe("清書を発言に当てる", () => {
  it("整えた文を使い、元の文も残す", () => {
    expect(applyCleaned([u("u1", "えー、母は風呂が好きでした")], [{ id: "u1", text: "母はお風呂が好きでした" }])[0]).toMatchObject({ original: "えー、母は風呂が好きでした", text: "母はお風呂が好きでした" });
  });

  it("抜けた発言と、長さが大きく変わった清書は元の文のまま", () => {
    const out = applyCleaned([u("u1", "はい"), u("u2", "母はお風呂が好きでした")], [{ id: "u2", text: "母はお風呂が好きで、毎日長湯をして、いつも楽しそうにしていました" }]);
    expect(out.map((l) => l.text)).toEqual(["はい", "母はお風呂が好きでした"]);
  });
});

describe("打合せの記録", () => {
  it("要約と清書を作り、決まったことは案件の決定から並べる", async () => {
    const s = state([u("u1", "えー、家で過ごしたいです"), u("u2", "承知しました", "staff")], { chief_mourner: { value: "長女", status: "confirmed", utteranceIds: [] }, resting_place: { value: "自宅", status: "candidate", utteranceIds: ["u1"] } });
    const r = await buildReport(s, [], { summarize, clean: echoClean }, 100, "r1");
    expect(r?.number).toBe(1);
    expect(r?.overview).toBe("母の思い出を伺った。");
    expect(r?.familyVoice[0]?.utteranceIds).toEqual(["u1"]);
    expect(r?.transcript.map((l) => l.text)).toEqual(["家で過ごしたいです", "承知しました"]);
    expect(r?.decided.map((d) => d.value)).toEqual(["長女"]);
    expect(r?.candidates.map((d) => d.value)).toEqual(["自宅"]);
    expect(r?.familyPrepare).toEqual(["遺影の写真"]);
    expect(r?.toDecide).toEqual(["日程"]);
  });

  it("2回目は、前回の記録のあとの発言だけを使い、新しい発言がなければ作らない", async () => {
    const first = await buildReport(state([u("u1", "一回目の話です")]), [], { summarize, clean: echoClean }, 1, "r1");
    const second = await buildReport(state([u("u1", "一回目の話です"), u("u2", "二回目の話です")]), [first!], { summarize, clean: echoClean }, 2, "r2");
    expect(second?.number).toBe(2);
    expect(second?.transcript.map((l) => l.id)).toEqual(["u2"]);
    expect(await buildReport(state([u("u1", "一回目の話です")]), [first!], { summarize, clean: echoClean }, 3, "r3")).toBeUndefined();
  });

  it("長い打合せは分けて清書を頼み、失敗した塊は元の文のまま", async () => {
    const many = Array.from({ length: CLEAN_CHUNK + 5 }, (_, i) => u(`u${i}`, `えー、発言${i}です`));
    let calls = 0;
    const flaky: CleanModel = vi.fn(async (sys, prompt) => {
      calls += 1;
      if (calls === 2) throw new Error("落ちた");
      return echoClean(sys, prompt);
    });
    const r = await buildReport(state(many), [], { summarize, clean: flaky }, 1, "r1");
    expect(flaky).toHaveBeenCalledTimes(2);
    expect(r?.transcript[0]?.text).toBe("発言0です");
    expect(r?.transcript.at(-1)?.text).toBe(`えー、発言${CLEAN_CHUNK + 4}です`);
  });
});

describe("これまでの打合せの記録", () => {
  it("続きの打合せでは、前回までの要点を指示に足す（なければ足さない）", async () => {
    const first = await buildReport(state([u("u1", "一回目の話です")]), [], { summarize, clean: echoClean }, 1, "r1");
    expect(previousMeetingsPrompt([])).toBe("");
    const p = previousMeetingsPrompt([first!]);
    expect(p).toContain("第1回");
    expect(p).toContain("これから決めること：日程");
  });
});
