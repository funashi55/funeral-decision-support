import { describe, expect, test } from "vitest";
import { accessDigest, isOpenPath, safeNext } from "./access";
import { spendAiCall } from "./budget";
import { createTestKv } from "./kv";
import { createCaseStore, TRIAL_PREFIX } from "./store";
import { listHearings, listNotes, listVeteranSubmissions, saveHearing, saveNote, saveVeteranSubmission } from "./trialFeedback";

const req = (ip = "203.0.113.5"): Request => new Request("https://example.test/api", { headers: { "x-forwarded-for": ip } });

describe("案件の保存場所", () => {
  test("デモの案件は保存前でも最初の状態から読める", async () => {
    const store = createCaseStore(createTestKv());
    const demo = await store.get("demo-yamada");
    expect(demo?.utterances).toEqual([]);
    expect(await store.findByToken(demo!.familyToken!)).toMatchObject({ caseId: "demo-yamada" });
  });

  test("試用の案件は人ごとに別の id と合言葉になり、混ざらない", async () => {
    const store = createCaseStore(createTestKv());
    const a = await store.createTrial();
    const b = await store.createTrial();
    expect(a.caseId.startsWith(TRIAL_PREFIX)).toBe(true);
    expect(a.caseId).not.toBe(b.caseId);
    expect(a.familyToken).not.toBe(b.familyToken);
    await store.save({ ...a, utterances: [{ id: "U1", speaker: "staff", speakerLabel: "担当", text: "こんにちは", at: 0 }] });
    expect((await store.get(b.caseId))?.utterances).toEqual([]);
  });

  test("保存のたびに版の番号が増える（配信が変化に気づける）", async () => {
    const store = createCaseStore(createTestKv());
    const a = await store.createTrial();
    const before = await store.revision(a.caseId);
    await store.save(a);
    expect(await store.revision(a.caseId)).toBe(before + 1);
  });

  test("合言葉を作り直すと、古い合言葉では引けない", async () => {
    const store = createCaseStore(createTestKv());
    const a = await store.createTrial();
    const old = a.familyToken!;
    await store.save({ ...a, familyToken: "new-token-123" });
    expect(await store.findByToken(old)).toBeUndefined();
    expect(await store.findByToken("new-token-123")).toMatchObject({ caseId: a.caseId });
  });

  test("試用で公開しているときは、リポジトリに載っている窓口の合言葉では開けない", async () => {
    process.env.ACCESS_CODE = "test-code";
    try {
      const store = createCaseStore(createTestKv());
      const demo = await store.get("demo-yamada");
      expect(demo?.familyToken).not.toBe("yamada-k7m2q9");
      expect(await store.findByToken("yamada-k7m2q9")).toBeUndefined();
      expect(await store.findByToken(demo!.familyToken!)).toMatchObject({ caseId: "demo-yamada" });
    } finally {
      delete process.env.ACCESS_CODE;
    }
  });

  test("知らない案件は最初に戻せない", async () => {
    const store = createCaseStore(createTestKv());
    expect(await store.reset("someone-else")).toBeUndefined();
    expect(await store.reset(`${TRIAL_PREFIX}missing`)).toBeUndefined();
  });
});

describe("AI を呼ぶ回数の上限", () => {
  test("1人あたりの上限を超えると断る", async () => {
    const kv = createTestKv();
    const limits = { daily: 100, hourlyPerClient: 2 };
    expect(await spendAiCall(req(), kv, limits)).toBeNull();
    expect(await spendAiCall(req(), kv, limits)).toBeNull();
    expect((await spendAiCall(req(), kv, limits))?.status).toBe(429);
    expect(await spendAiCall(req("198.51.100.9"), kv, limits)).toBeNull();
  });

  test("1日全体の上限を超えると、誰からでも断る", async () => {
    const kv = createTestKv();
    const limits = { daily: 1, hourlyPerClient: 100 };
    expect(await spendAiCall(req("198.51.100.1"), kv, limits)).toBeNull();
    expect((await spendAiCall(req("198.51.100.2"), kv, limits))?.status).toBe(429);
  });
});

describe("試用の入口", () => {
  test("ご家族の窓口と入口そのものは合言葉なしで開ける", () => {
    expect(isOpenPath("/f/abc")).toBe(true);
    expect(isOpenPath("/api/family/abc/chat")).toBe(true);
    expect(isOpenPath("/gate")).toBe(true);
    expect(isOpenPath("/staff/demo-yamada")).toBe(false);
    expect(isOpenPath("/api/veteran/answers")).toBe(false);
  });

  test("戻る先は同じサイトの道筋だけ", () => {
    expect(safeNext("/veteran")).toBe("/veteran");
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext("/\\evil.example")).toBe("/");
    expect(safeNext(null)).toBe("/");
  });

  test("cookie には合言葉そのものを置かない", async () => {
    const digest = await accessDigest("sakura");
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).not.toContain("sakura");
  });
});

describe("ベテランの答えと感想", () => {
  test("答えを保存して取り出せる", async () => {
    const kv = createTestKv();
    await saveVeteranSubmission({ respondent: "A", scenes: { J01: { fits: { yukan: "consider" }, reason: "まず聞く" } } }, kv, 1);
    expect(await listVeteranSubmissions(kv)).toEqual([
      { respondent: "A", scenes: { J01: { fits: { yukan: "consider" }, reason: "まず聞く" } }, comment: "", at: 1 },
    ]);
  });

  test("ない場面・ない選択肢・ない答えは受け付けない", async () => {
    const kv = createTestKv();
    await expect(saveVeteranSubmission({ respondent: "A", scenes: { J99: { fits: {} } } }, kv)).rejects.toThrow();
    await expect(saveVeteranSubmission({ respondent: "A", scenes: { J01: { fits: { cremation: "suits" } } } }, kv)).rejects.toThrow();
    await expect(saveVeteranSubmission({ respondent: "A", scenes: { J01: { fits: { yukan: "maybe" } } } }, kv)).rejects.toThrow();
    await expect(saveVeteranSubmission({ respondent: "", scenes: {} }, kv)).rejects.toThrow();
  });

  test("感想は空では送れない", async () => {
    const kv = createTestKv();
    await expect(saveNote({ page: "/staff/x", text: "  " }, kv)).rejects.toThrow();
    await saveNote({ page: "/staff/x", text: "ここは現場ではこう言う" }, kv, 5);
    expect(await listNotes(kv)).toEqual([{ name: "", page: "/staff/x", text: "ここは現場ではこう言う", at: 5 }]);
  });
});

describe("ロールプレイの聞き取り", () => {
  const base = {
    respondent: "ベテランA",
    experience: "over10",
    sceneId: "P1",
    mode: "voice",
    turns: [
      { role: "veteran", speaker: "担当者", text: "お孫さんとのご関係を伺えますか" },
      { role: "family", speaker: "長女", text: "おばあちゃん子でした" },
    ],
    revealed: ["P1-people"],
    fits: { yukan: "unknown", standard_laying: "suits" },
    judgments: [{ when: "孫が遠方", do: "日程より先に関係を聞く", why: "", quote: "お孫さんとのご関係を伺えますか", verdict: "agree" }],
  };

  test("1場面分を保存して取り出せる。わからないも答えとして残る", async () => {
    const kv = createTestKv();
    await saveHearing(base, kv, 5);
    const [saved] = await listHearings(kv);
    expect(saved?.at).toBe(5);
    expect(saved?.fits.yukan).toBe("unknown");
    expect(saved?.judgments[0]?.note).toBe("");
  });

  test("ない場面・ない入力の方法・長すぎる発言は受け付けない", async () => {
    const kv = createTestKv();
    await expect(saveHearing({ ...base, sceneId: "P99" }, kv)).rejects.toThrow();
    await expect(saveHearing({ ...base, mode: "video" }, kv)).rejects.toThrow();
    await expect(saveHearing({ ...base, experience: "veteran" }, kv)).rejects.toThrow();
    await expect(saveHearing({ ...base, turns: [{ role: "veteran", speaker: "担当者", text: "あ".repeat(900) }] }, kv)).rejects.toThrow();
  });
});
