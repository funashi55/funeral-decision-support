import { describe, expect, it } from "vitest";
import { RegistrationSchema, caseFromRegistration, normalizeFamilyName, type Registration } from "./registration";

const base = {
  familyName: "佐藤",
  deceased: { age: "82", sex: "男性" },
  chiefMourner: { relation: "長男", name: "佐藤一郎", phone: "090-0000-0000" },
  membership: "互助会の会員",
  funeralStyle: "未定",
  religion: "曹洞宗",
  temple: "",
  restingPlace: "自宅",
};
const parse = (input: unknown): Registration => ({ ...RegistrationSchema.parse(input), registeredAt: 1 });

describe("喪家の登録", () => {
  it("家名に「家」を付け、受付で聞いた事実を確定済みの決定にする", () => {
    const state = caseFromRegistration("case-x", "tok", parse(base));
    expect(state.familyName).toBe("佐藤家");
    expect(state.decisions.chief_mourner).toEqual({ value: "長男・佐藤一郎", status: "confirmed", utteranceIds: [] });
    expect(state.decisions.membership?.value).toBe("会員");
    expect(state.decisions.religion?.value).toBe("曹洞宗");
    expect(state.decisions.resting_place?.value).toBe("自宅");
    expect(state.profile.deceasedAge).toBe(82);
    expect(state.utterances).toEqual([]);
  });

  it("未定・わからない・空欄は決定にしない（打合せで決める）", () => {
    const state = caseFromRegistration("case-x", "tok", parse({ ...base, membership: "わからない", restingPlace: "未定" }));
    expect(state.decisions.membership).toBeUndefined();
    expect(state.decisions.funeral_style).toBeUndefined();
    expect(state.decisions.temple).toBeUndefined();
    expect(state.decisions.resting_place).toBeUndefined();
  });

  it("会員でないと登録したら、見積もりは一般価格になる決定になる", () => {
    const state = caseFromRegistration("case-x", "tok", parse({ ...base, membership: "会員ではない" }));
    expect(state.decisions.membership?.value).toMatch(/一般/);
  });

  it("家名がなければ登録できない。喪主の続柄は空でもよく、電話番号の形は確かめる", () => {
    expect(RegistrationSchema.safeParse({ ...base, familyName: " " }).success).toBe(false);
    expect(RegistrationSchema.safeParse({ ...base, chiefMourner: { relation: "" } }).success).toBe(true);
    expect(RegistrationSchema.safeParse({ familyName: "佐藤" }).success).toBe(true);
    expect(RegistrationSchema.safeParse({ ...base, chiefMourner: { relation: "長男", phone: "abc" } }).success).toBe(false);
  });

  it("「家」が付いていれば重ねない", () => {
    expect(normalizeFamilyName("山田家")).toBe("山田家");
  });
});
