import { describe, expect, it } from "vitest";
import { applyExtraction, type Extraction } from "./extract";
import { confirmFact, factValue } from "./facts";
import { DEMO_CASE } from "./fixtures/demoCase";
import { RegistrationSchema, caseFromRegistration, decisionsFrom } from "./registration";

const minimal = { ...RegistrationSchema.parse({ familyName: "佐藤" }), registeredAt: 1 };
const fresh = { ...caseFromRegistration("case-x", "t", minimal), utterances: DEMO_CASE.utterances };
const found = (facts: Extraction["facts"]): Extraction => ({ circumstances: [], candidates: [], facts, profile: { daysUntilFuneral: null, deceasedAge: null, funeralStyle: null } });

describe("家名だけの登録", () => {
  it("家名だけで登録でき、ほかは未登録・未定のまま", () => {
    expect(minimal).toMatchObject({ familyName: "佐藤", membership: "わからない", funeralStyle: "未定", restingPlace: "未定" });
    expect(minimal.chiefMourner.relation).toBeUndefined();
  });

  it("喪主がわからなければ、喪主を確定済みにしない（会話で決める）", () => {
    expect(decisionsFrom(minimal)).toEqual({});
    expect(fresh.familyName).toBe("佐藤家");
  });
});

describe("会話から受付の事実を埋める", () => {
  it("拾えた事実は候補として入り、登録（確定）にはならない", () => {
    const next = applyExtraction(fresh, found([{ key: "deceasedSex", value: "女性", utteranceIds: ["U4"] }]));
    expect(next.factCandidates?.deceasedSex).toEqual({ value: "女性", utteranceIds: ["U4"] });
    expect(factValue(next.registration, "deceasedSex")).toBeUndefined();
  });

  it("根拠の発言がない値・形の合わない値は捨てる", () => {
    const next = applyExtraction(
      fresh,
      found([
        { key: "deceasedName", value: "ハナ", utteranceIds: ["U99"] },
        { key: "deceasedAge", value: "八十四", utteranceIds: ["U4"] },
      ]),
    );
    expect(next.factCandidates).toEqual({});
  });

  it("担当者が確定すると登録に入り、候補は消える。確定した事実は会話で上書きしない", () => {
    const withCandidate = applyExtraction(fresh, found([{ key: "deceasedAge", value: "84", utteranceIds: ["U4"] }]));
    const done = confirmFact(withCandidate, "deceasedAge", "84", 2);
    expect(done.registration?.deceased.age).toBe(84);
    expect(done.profile.deceasedAge).toBe(84);
    expect(done.factCandidates?.deceasedAge).toBeUndefined();
    const again = applyExtraction(done, found([{ key: "deceasedAge", value: "85", utteranceIds: ["U4"] }]));
    expect(again.registration?.deceased.age).toBe(84);
    expect(again.factCandidates?.deceasedAge).toBeUndefined();
  });

  it("あとで変わった事実は書き直せる。形の合わない値は断る", () => {
    const named = confirmFact(fresh, "mournerName", "佐藤 一郎", 2);
    expect(confirmFact(named, "mournerName", "佐藤 花子", 3).registration?.chiefMourner.name).toBe("佐藤 花子");
    expect(() => confirmFact(fresh, "mournerPhone", "でんわ", 2)).toThrow();
  });

  it("登録のない案件（試用のデモ）でも、事実を確定すると登録ができる", () => {
    const trial = { ...DEMO_CASE, registration: undefined };
    expect(confirmFact(trial, "staffName", "鈴木", 5).registration).toMatchObject({ familyName: DEMO_CASE.familyName, staffName: "鈴木", registeredAt: 5 });
  });
});
