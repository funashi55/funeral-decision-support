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
    expect(iceOf(standard)).toBe(4);
  });

  test("自宅で安置するなら、安置料を足さない", () => {
    const [simple] = buildPlanProposals(decided({ resting_place: "自宅" }));
    expect(simple!.estimate.lines.some((l) => l.label === getCatalogItem("resting_fee").label)).toBe(false);
  });

  test("湯灌を選んだら足し、含まれないものから湯灌が消える", () => {
    const [simple] = buildPlanProposals(decided({ laying_in_style: "湯灌を行う" }));
    expect(simple!.estimate.lines.some((l) => l.unitPrice === getCatalogItem("yukan").unitPrice)).toBe(true);
    expect(simple!.estimate.notIncluded).not.toContain("湯灌");
  });

  test("人数が決まっていなければ、会食と香典返しは金額に入れず「人数が決まってから」と示す", () => {
    const [simple] = buildPlanProposals(DEMO_CASE);
    expect(simple!.pendingCounts).toEqual(["料理（人数が決まってから）", "香典返し（人数が決まってから）"]);
    expect(simple!.estimate.notIncluded).toContain("料理");
  });

  test("人数が分かれば、会食と香典返しを人数分足す", () => {
    const [simple] = buildPlanProposals(decided({ attendees_scope: "15名ほど" }));
    const expected = buildEstimate("altar_simple", [
      { itemId: "dry_ice", quantity: 4 },
      { itemId: "resting_fee", quantity: 5 },
      { itemId: "hall_fee", quantity: 2 },
      { itemId: "meal", quantity: 15 },
      { itemId: "return_gift", quantity: 15 },
    ]);
    expect(simple!.estimate.total).toBe(expected.total);
    expect(simple!.pendingCounts).toEqual([]);
  });

  test("火葬式なら会場使用料を足さない", () => {
    const [simple] = buildPlanProposals(decided({}, { funeralStyle: "火葬式", daysUntilFuneral: 2 }));
    expect(simple!.estimate.lines.some((l) => l.label === getCatalogItem("hall_fee").label)).toBe(false);
  });

  test("会員でないと決まったら一般価格で見積もり、決まっていなければ会員価格で見積もる", () => {
    const [member] = buildPlanProposals(DEMO_CASE);
    const [general] = buildPlanProposals(decided({ membership: "一般（会員ではない）" }));
    expect(member!.estimate.tier).toBe("member");
    expect(general!.estimate.tier).toBe("general");
    expect(general!.estimate.lines[0]?.unitPrice).toBe(getPlan("altar_simple").generalPrice);
    expect(general!.estimate.total).toBeGreaterThan(member!.estimate.total);
  });

  test("会話から拾った候補でも品目を足し、どの発言から来たかと、まだ候補であることを添える", () => {
    const state: CaseState = {
      ...DEMO_CASE,
      utterances: [{ id: "U1", speaker: "chief_mourner", speakerLabel: "喪主", text: "新聞のお悔やみ欄には載せてください", at: 0 }],
      decisions: { obituary: { value: "載せる", status: "candidate", utteranceIds: ["U1"] } },
    };
    const [simple] = buildPlanProposals(state);
    const note = simple!.additions.find((a) => a.label === "新聞のお悔やみ欄");
    expect(note?.source).toEqual({ decisionId: "obituary", status: "candidate", quote: "新聞のお悔やみ欄には載せてください" });
  });

  test("有料のオプションは推測では入れない：好きなことの話や、問いかけからは足さない", () => {
    const state: CaseState = {
      ...DEMO_CASE,
      utterances: [
        { id: "U1", speaker: "chief_mourner", speakerLabel: "喪主", text: "母はお風呂が好きでした", at: 0 },
        { id: "U2", speaker: "chief_mourner", speakerLabel: "喪主", text: "新聞のお悔やみ欄にも出したほうがいいんでしょうか。", at: 1 },
      ],
      decisions: {
        laying_in_style: { value: "湯灌", status: "candidate", utteranceIds: ["U1"] },
        obituary: { value: "検討中", status: "candidate", utteranceIds: ["U2"] },
      },
    };
    const [simple] = buildPlanProposals(state);
    expect(simple!.additions.map((a) => a.label)).not.toContain("湯灌");
    expect(simple!.additions.map((a) => a.label)).not.toContain("新聞のお悔やみ欄");
  });

  test("火葬場へ行く人数から送迎車の台数を出し、載せないと決めたお悔やみ欄は足さない", () => {
    const [simple] = buildPlanProposals(decided({ crematorium_party: "20名", obituary: "載せない" }));
    expect(simple!.additions.find((a) => a.label === "火葬場への送迎車")?.quantity).toBe(3);
    expect(simple!.additions.some((a) => a.label === "新聞のお悔やみ欄")).toBe(false);
  });

  test("人数を読む", () => {
    expect(readCount("15名ほど")).toBe(15);
    expect(readCount("30人くらい")).toBe(30);
    expect(readCount("家族だけ")).toBeNull();
    expect(readCount(undefined)).toBeNull();
  });
});

describe("断った有料の選択肢を、見積もりに入れない", () => {
  const ok = (value: string) => ({ value, status: "confirmed" as const, utteranceIds: [] });
  const items = (decisions: CaseState["decisions"]) => buildPlanProposals({ ...DEMO_CASE, decisions })[0]?.additions.map((a) => a.label) ?? [];

  test("「湯灌はせず」「湯灌はしなくて大丈夫」は、湯灌を足さない", () => {
    expect(items({ laying_in_style: ok("湯灌はせず、普通の納棺") })).not.toContain("湯灌");
    expect(items({ laying_in_style: ok("湯灌はしなくて大丈夫") })).not.toContain("湯灌");
    expect(items({ laying_in_style: ok("湯灌を行う") })).toContain("湯灌");
  });

  test("「エンバーミングは不要」は、エンバーミングを足さない", () => {
    expect(items({ embalming: ok("エンバーミングは不要") })).not.toContain("エンバーミング");
  });

  test("香典返しは、確定した数（30個）をそのまま使う", () => {
    const gifts = buildPlanProposals({ ...DEMO_CASE, decisions: { return_gifts: ok("30個"), attendees_scope: ok("約15名") } })[0]?.additions.find((a) => a.label === "香典返し");
    expect(gifts?.quantity).toBe(30);
  });
});
