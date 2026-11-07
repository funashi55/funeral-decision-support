import { describe, expect, it } from "vitest";
import type { CaseState } from "./case";
import { DEMO_CASE } from "./fixtures/demoCase";
import { OrderSheetError, SHEETABLE_ORDERS, buildOrderSheet } from "./orderSheet";

const state = (decisions: CaseState["decisions"] = {}): CaseState => ({ ...DEMO_CASE, decisions });
const done = (value: string) => ({ value, status: "confirmed" as const, utteranceIds: [] });

describe("発注書を1枚ずつ作る", () => {
  it("確定した数をそのまま数量に書き、送れる状態にする前提がそろえば ready になる", () => {
    const { sheet } = buildOrderSheet(state({ return_gifts: done("80個") }), "return_gifts");
    expect(sheet.status).toBe("ready");
    expect(sheet.items[0]?.quantity).toBe("80個");
    expect(sheet.vendor).toBe("返礼品店");
  });

  it("前提が確定していなければ下書き（確定待ち）として作り、わからない欄は要確認にする", () => {
    const { sheet } = buildOrderSheet(state(), "return_gifts");
    expect(sheet.status).toBe("waiting");
    expect(sheet.items[0]?.quantity).toBe("要確認");
    expect(sheet.blanks).toBeGreaterThan(0);
  });

  it("電話で済む手配や、要らない手配は発注書にしない", () => {
    expect(() => buildOrderSheet(state(), "temple_contact")).toThrow(OrderSheetError);
    expect(() => buildOrderSheet(state({ meals: done("なし") }), "meals")).toThrow(OrderSheetError);
  });

  it("金額は書かない", () => {
    const { sheet } = buildOrderSheet(state({ return_gifts: done("80個") }), "return_gifts");
    expect(JSON.stringify(sheet)).not.toMatch(/円/);
  });
});

describe("発注書に、案件で確定した値を入れる", () => {
  const settled = (extra: CaseState["decisions"] = {}): CaseState => ({
    ...DEMO_CASE,
    registration: {
      familyName: "山田",
      staffName: undefined,
      deceased: { name: "山田 ハナ", age: 84, sex: "女性", diedAt: "2026-11-07T05:30", diedPlace: "市内の病院" },
      chiefMourner: { relation: "長女", name: undefined, phone: undefined },
    homeAddress: undefined,
      membership: "わからない",
      funeralStyle: "家族葬",
      restingPlace: "会館",
      religion: undefined,
      temple: undefined,
      memo: undefined,
      registeredAt: 0,
    },
    decisions: {
      attendees_scope: done("家族と故人の妹たち 約15名"),
      wake_held: done("行う"),
      wake_date: done("11月10日 18時 東斎場"),
      funeral_date: done("11月11日 10時 東斎場"),
      cremation_date: done("11月11日 12時 市営斎場"),
      laying_in_date: done("11月10日 14時"),
      altar_plan: done("生花祭壇（小）"),
      flower_color: done("白と淡い黄色。庭の花に近い色"),
      deceased_character: done("お風呂が好き、庭の花の手入れ"),
      return_gifts: done("30個"),
      meals: done("15名"),
      crematorium_party: done("10名"),
      ...extra,
    },
  });

  it("届け先は葬儀の会場、届け日時は品物ごとに通夜・葬儀の日時から決める", () => {
    const { sheet } = buildOrderSheet(settled(), "flowers");
    expect(sheet.deliverTo).toBe("東斎場");
    expect(sheet.deliverAt).toContain("11月10日");
    expect(sheet.items[0]?.name).toContain("生花祭壇（小）");
    expect(sheet.extras).toEqual(expect.arrayContaining([expect.objectContaining({ label: "色合い", value: "白と淡い黄色。庭の花に近い色" })]));
    expect(sheet.blanks).toBe(0);
  });

  it("日程の欄と故人の情報は、決定と登録から埋める", () => {
    const { context } = buildOrderSheet(settled(), "flowers");
    expect(context.schedule.wake).toBe("11月10日 18時 東斎場");
    expect(context.schedule.funeral).toBe("11月11日 10時 東斎場");
    expect(context.schedule.departure).toContain("11月11日");
    expect(context.schedule.death).toContain("11月7日");
    expect(context.deceased).toEqual({ age: "84歳", sex: "女性" });
    expect(context.venue).toBe("東斎場");
  });

  it("数は決定の値から読み、料理・タクシーは人数から数える", () => {
    expect(buildOrderSheet(settled(), "return_gifts").sheet.items[0]?.quantity).toBe("30個");
    expect(buildOrderSheet(settled(), "meals").sheet.items[0]?.quantity).toBe("15名分");
    expect(buildOrderSheet(settled(), "taxi").sheet.items[0]?.quantity).toBe("3台");
  });

  it("香典返しには、返品できるかの確認を添える", () => {
    const { sheet } = buildOrderSheet(settled(), "return_gifts");
    expect(sheet.extras.map((e) => e.label)).toContain("余りの返品");
  });

  it("通夜をしない式（一日葬）では、通夜の日ではなく葬儀の日に届ける", () => {
    const { sheet } = buildOrderSheet(settled({ wake_held: done("行わない"), wake_date: undefined as never }), "flowers");
    expect(sheet.deliverAt).toContain("11月11日");
  });
});

describe("デモの打合せのあとに確定する値で、発注書が埋まる", () => {
  it("手配できる発注書には、要確認の欄が残らない", async () => {
    const { DEMO_SETTLED } = await import("./fixtures/demoSettled");
    const { buildOrders } = await import("./orders");
    const s: CaseState = { ...DEMO_CASE, decisions: Object.fromEntries(Object.entries(DEMO_SETTLED).map(([k, v]) => [k, done(v)])) };
    const ready = buildOrders(s).filter((o) => o.status === "ready" && SHEETABLE_ORDERS.has(o.id));
    expect(ready.length).toBeGreaterThan(4);
    const left = ready.map((o) => buildOrderSheet(s, o.id)).filter((x) => x.sheet.blanks > 0).map((x) => `${x.sheet.orderId}:${JSON.stringify(x.sheet)}`);
    expect(left).toEqual([]);
  });
});

describe("要らない手配の見分け", () => {
  it("「湯灌はせず」のように湯灌を断っているときは、湯灌の依頼を出さない", async () => {
    const { buildOrders } = await import("./orders");
    const row = buildOrders({ ...DEMO_CASE, decisions: { laying_in_style: done("湯灌はせず、普通の納棺"), laying_in_date: done("11月10日14時") } }).find((o) => o.id === "yukan");
    expect(row?.status).toBe("not_needed");
    const want = buildOrders({ ...DEMO_CASE, decisions: { laying_in_style: done("湯灌をお願いする"), laying_in_date: done("11月10日14時") } }).find((o) => o.id === "yukan");
    expect(want?.status).toBe("ready");
  });
});
