import { describe, expect, it } from "vitest";
import { RegistrationSchema } from "../engine/registration";
import { createTestKv } from "./kv";
import { createCaseStore } from "./store";

const reg = (familyName: string, at: number) => ({
  ...RegistrationSchema.parse({ familyName, deceased: {}, chiefMourner: { relation: "長女" }, membership: "わからない", funeralStyle: "家族葬", restingPlace: "会館" }),
  registeredAt: at,
});

describe("喪家の登録（保存）", () => {
  it("登録すると案件ができ、一覧に新しい順で並ぶ", async () => {
    const store = createCaseStore(createTestKv());
    const a = await store.createCase(reg("佐藤", 1));
    const b = await store.createCase(reg("鈴木", 2));
    expect(a.caseId).toMatch(/^case-/);
    expect((await store.get(b.caseId))?.familyName).toBe("鈴木家");
    expect((await store.listCases()).map((c) => c.familyName)).toEqual(["鈴木家", "佐藤家"]);
  });

  it("最初からやり直すと、会話は消えて登録した内容は残る", async () => {
    const store = createCaseStore(createTestKv());
    const a = await store.createCase(reg("佐藤", 1));
    await store.save({ ...a, utterances: [{ id: "U1", speaker: "staff", speakerLabel: "担当者", text: "よろしくお願いします", at: 0 }] });
    const reset = await store.reset(a.caseId);
    expect(reset?.utterances).toEqual([]);
    expect(reset?.decisions.funeral_style?.value).toBe("家族葬");
    expect(reset?.familyToken).toBe(a.familyToken);
  });
});
