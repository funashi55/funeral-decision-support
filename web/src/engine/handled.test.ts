import { describe, expect, it } from "vitest";
import type { CaseState, Utterance } from "./case";
import { DEMO_CASE } from "./fixtures/demoCase";
import { FAREWELL_CUES, FAREWELL_DECISION, handledBy, keywordCues, keywordHits, textKey } from "./handled";
import { TOPIC_CUES } from "./nextSteps";

const line = (id: string, speaker: Utterance["speaker"], text: string): Utterance => ({ id, speaker, speakerLabel: speaker === "staff" ? "担当者" : "喪主", text, at: 0 });
const state = (over: Partial<CaseState> = {}): CaseState => ({ ...DEMO_CASE, utterances: [line("U1", "chief_mourner", "母はお風呂が好きでした")], decisions: {}, feedback: [], ...over });
const yukan = { target: "farewell:yukan", decisionId: FAREWELL_DECISION.yukan, cues: FAREWELL_CUES.yukan, basedOn: 1 };

describe("提案が済んだか", () => {
  it("何もしていなければ、済んでいない", () => {
    expect(handledBy(state(), yukan)).toBeNull();
  });

  it("「伝えた／使わない」を押したら済む", () => {
    expect(handledBy(state({ feedback: [{ target: "farewell:yukan", verdict: "unused", at: 1 }] }), yukan)).toBe("unused");
  });

  it("関係する項目を確定したら済む", () => {
    expect(handledBy(state({ decisions: { laying_in_style: { value: "湯灌", status: "confirmed", utteranceIds: [] } } }), yukan)).toBe("confirmed");
  });

  it("提案のあとに担当者が触れたら済む。提案より前の発言やご家族の発言では済まない", () => {
    const before = state({ utterances: [line("U1", "staff", "湯灌という形もあります"), line("U2", "chief_mourner", "そうですか")] });
    expect(handledBy(before, { ...yukan, basedOn: 2 })).toBeNull();
    const familySaid = state({ utterances: [line("U1", "chief_mourner", "母はお風呂が好き"), line("U2", "chief_mourner", "湯灌ってなんですか")] });
    expect(handledBy(familySaid, yukan)).toBeNull();
    const told = state({ utterances: [line("U1", "chief_mourner", "母はお風呂が好き"), line("U2", "staff", "納棺の前にお体を洗い清める形もございます")] });
    expect(handledBy(told, yukan)).toBe("spoken");
  });

  it("注意は、きっかけの発言のあとに担当者がその話題に触れたら済む", () => {
    const alert = { target: "oversight:pacemaker", decisionId: "pacemaker", cues: TOPIC_CUES.pacemaker, basedOn: 1 };
    const before = state({ utterances: [line("U1", "chief_mourner", "火葬は明後日がいいです")] });
    expect(handledBy(before, alert)).toBeNull();
    const told = state({ utterances: [line("U1", "chief_mourner", "火葬は明後日がいいです"), line("U2", "staff", "火葬の前に、ペースメーカーは入っていらっしゃいましたか")] });
    expect(handledBy(told, alert)).toBe("spoken");
  });

  it("尋ねること・声かけは、勧めた文の語が担当者の発言に2つ重なれば済み、1つだけでは済まない", () => {
    const q = "お孫さんの到着の時刻と、お顔を見ていただく時間を伺う";
    const cues = keywordCues(q);
    const check = { target: `question:${textKey(q)}`, cues, minHits: keywordHits(cues), basedOn: 1 };
    const once = state({ utterances: [line("U1", "chief_mourner", "孫が来ます"), line("U2", "staff", "到着はいつごろでしょう")] });
    expect(handledBy(once, check)).toBeNull();
    const twice = state({ utterances: [line("U1", "chief_mourner", "孫が来ます"), line("U2", "staff", "お孫さんの到着は何時ごろで、どのくらいの時間お顔を見ていただけそうですか")] });
    expect(handledBy(twice, check)).toBe("spoken");
  });

  it("どの文にも出やすい語は手がかりにしない", () => {
    expect(keywordCues("ご家族と葬儀の確認").map(String)).toEqual([]);
  });

  it("尋ねることの識別子は、同じ文なら同じになる", () => {
    expect(textKey("ご親戚はどちらに")).toBe(textKey("ご親戚はどちらに"));
    expect(textKey("ご親戚はどちらに")).not.toBe(textKey("お寺はどちらに"));
  });
});
