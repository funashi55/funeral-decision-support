import { describe, expect, test } from "vitest";
import type { CaseState, Utterance } from "./case";
import { DEMO_CASE } from "./fixtures/demoCase";
import { checkText } from "./guard";
import { OVERSIGHT_RULES, detectOversights } from "./oversight";

const say = (text: string, id = "U1"): Utterance => ({ id, speaker: "chief_mourner", speakerLabel: "喪主", text, at: 0 });
const caseWith = (utterances: Utterance[], extra: Partial<CaseState> = {}): CaseState => ({
  ...DEMO_CASE,
  utterances,
  decisions: {},
  profile: { deceasedAge: 84 },
  ...extra,
});
const ids = (s: CaseState): string[] => detectOversights(s).map((a) => a.id);

describe("見落としの先回り", () => {
  test("お悔やみ欄の話が出たら、掲載の前の家族確認を知らせる", () => {
    const alerts = detectOversights(caseWith([say("新聞のお悔やみ欄にも出したほうがいいんでしょうか")]));
    const a = alerts.find((x) => x.id === "obituary_unnotified");
    expect(a?.utteranceIds).toEqual(["U1"]);
    expect(a?.decisionLabel).toBe("新聞のお悔やみ欄への掲載");
  });

  test("火葬の話が出たら、ペースメーカーの確認を知らせる。確定済みなら知らせない", () => {
    const s = caseWith([say("火葬はいつになりますか")]);
    expect(ids(s)).toContain("pacemaker_before_cremation");
    const done = { ...s, decisions: { pacemaker: { value: "なし", status: "confirmed" as const, utteranceIds: [] } } };
    expect(ids(done)).not.toContain("pacemaker_before_cremation");
  });

  test("市外のお寺なら、住職の都合を先に伺うよう知らせる", () => {
    expect(ids(caseWith([say("お寺は父の実家の菩提寺で、市外なんです")]))).toContain("temple_outside_city");
    expect(ids(caseWith([say("お寺は近所です")]))).not.toContain("temple_outside_city");
  });

  test("遠方の親族の到着が話に出たら、火葬の日を急がないよう知らせる", () => {
    expect(ids(caseWith([say("孫が東京にいて、着くのは3日後になりそうです")]))).toContain("relatives_before_cremation");
  });

  test("火葬まで日があくなら、安置とドライアイスが含まれないことを知らせる", () => {
    expect(ids(caseWith([], { profile: { daysUntilFuneral: 6 } }))).toContain("resting_days_not_included");
    expect(ids(caseWith([], { profile: { daysUntilFuneral: 2 } }))).not.toContain("resting_days_not_included");
  });

  test("納棺の日時が先に出たら、湯灌を先に決めるよう知らせる", () => {
    const s = caseWith([], { decisions: { laying_in_date: { value: "明日の午後", status: "candidate", utteranceIds: [] } } });
    expect(ids(s)).toContain("yukan_before_laying_in");
  });

  test("何の手がかりもなければ、何も知らせない", () => {
    expect(detectOversights(caseWith([say("よろしくお願いします")]))).toEqual([]);
  });

  test("すべての知らせの文面が、守る線の検査を通る", () => {
    for (const rule of OVERSIGHT_RULES) expect(checkText(rule.message), rule.id).toEqual([]);
  });

  test("規則の ID は重複しない", () => {
    const all = OVERSIGHT_RULES.map((r) => r.id);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("足した見落としの先回り", () => {
  const base = (texts: readonly string[], decisions: CaseState["decisions"] = {}): CaseState => ({
    ...DEMO_CASE,
    decisions,
    utterances: texts.map((text, i) => ({ id: `U${i + 1}`, speaker: "chief_mourner", speakerLabel: "喪主", text, at: i })),
  });
    const candidate = (value: string) => ({ value, status: "candidate" as const, utteranceIds: [] });

  test("火葬の話が出たら、火葬許可（死亡届）の段取りを知らせる", () => {
    expect(ids(base(["火葬はいつになりますか"]))).toContain("permit_before_cremation");
  });

  test("火葬の日の候補が出たら、友引を知らせる。確定したら知らせない", () => {
    expect(ids(base([], { cremation_date: candidate("明後日") }))).toContain("tomobiki");
    expect(ids(base([], { cremation_date: { value: "明後日", status: "confirmed", utteranceIds: [] } }))).not.toContain("tomobiki");
  });

  test("棺に入れたいものの話が出たら、入れられないものを知らせる", () => {
    expect(ids(base(["母の眼鏡を棺に入れてあげたい"]))).toContain("coffin_items_limits");
  });

  test("ご家族が費用の話をしたら、葬祭費などを受け取れることを知らせる", () => {
    expect(ids(base(["費用はできるだけ抑えたいです"]))).toContain("funeral_benefit");
  });
});
