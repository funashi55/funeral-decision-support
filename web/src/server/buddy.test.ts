import { describe, expect, it } from "vitest";
import { addPhrase } from "../domain/buddy";
import { DEMO_CASE } from "../engine/fixtures/demoCase";
import type { CaseState } from "../engine/case";
import { createTestKv } from "./kv";
import { loadBuddy, resetDemoBuddy, updateBuddy } from "./buddy";

const withStaff = (caseId: string, staffName?: string): CaseState =>
  ({ ...DEMO_CASE, caseId, registration: staffName ? ({ staffName } as CaseState["registration"]) : undefined }) as CaseState;

describe("担当者ごとのバディの保存", () => {
  it("同じ担当者なら案件をまたいで同じバディが育つ", async () => {
    const kv = createTestKv();
    await updateBuddy(withStaff("case-aaa", "佐藤"), (p) => addPhrase(p, "acceptance", "ゆっくりで大丈夫です"), kv);
    const other = await loadBuddy(withStaff("case-bbb", "佐藤"), kv);
    expect(other.phrases.acceptance).toEqual(["ゆっくりで大丈夫です"]);
    expect((await loadBuddy(withStaff("case-ccc", "鈴木"), kv)).phrases).toEqual({});
  });

  it("デモで育てたものは本番の同じ名前の担当者に混ざらない", async () => {
    const kv = createTestKv();
    await updateBuddy(withStaff("trial-x", "佐藤"), (p) => addPhrase(p, "acceptance", "デモの言い方"), kv);
    expect((await loadBuddy(withStaff("case-aaa", "佐藤"), kv)).phrases).toEqual({});
  });

  it("名前のない案件は「担当者」のバディ", async () => {
    expect((await loadBuddy(withStaff("case-aaa"), createTestKv())).staffName).toBe("担当者");
  });

  it("デモの「最初から」でデモのバディは空に戻り、本番のバディは消えない", async () => {
    const kv = createTestKv();
    const demo = withStaff("demo-yamada", "佐藤");
    const live = withStaff("case-aaa", "佐藤");
    await updateBuddy(demo, (p) => addPhrase(p, "acceptance", "デモの言い方"), kv);
    await updateBuddy(live, (p) => addPhrase(p, "acceptance", "本番の言い方"), kv);
    await resetDemoBuddy(demo, kv);
    await resetDemoBuddy(live, kv);
    expect((await loadBuddy(demo, kv)).phrases).toEqual({});
    expect((await loadBuddy(live, kv)).phrases.acceptance).toEqual(["本番の言い方"]);
  });
});
