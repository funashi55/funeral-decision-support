import { describe, expect, it } from "vitest";
import { DEMO_CASE } from "./fixtures/demoCase";
import { addDrafts, applyTaskAction, markDoneByFamily, sharedTasks } from "./familyTasks";

const base = { ...DEMO_CASE, familyTasks: [] };

describe("ご家族へのお願い", () => {
  it("記録からは見せない下書きとして入り、同じ内容は重ねない", () => {
    const s = addDrafts(base, [{ kind: "prepare", text: "遺影の写真" }, { kind: "prepare", text: "遺影の 写真。" }, { kind: "research", text: "x" }], 1, "r1");
    expect(s.familyTasks).toHaveLength(1);
    expect(s.familyTasks?.[0]).toMatchObject({ kind: "prepare", text: "遺影の写真", shared: false, done: false, reportId: "r1" });
    expect(sharedTasks(s)).toEqual([]);
  });

  it("担当者が書き直して見せると、窓口に出る", () => {
    let s = addDrafts(base, [{ kind: "prepare", text: "遺影の写真" }], 1);
    const id = s.familyTasks![0]!.id;
    s = applyTaskAction(s, { action: "edit", id, text: "遺影に使うお写真を1〜2枚" }, 2);
    s = applyTaskAction(s, { action: "share", id, shared: true }, 3);
    expect(sharedTasks(s).map((t) => t.text)).toEqual(["遺影に使うお写真を1〜2枚"]);
    expect(base.familyTasks).toEqual([]);
  });

  it("ご家族は見せているものだけ済みにでき、消したものは操作できない", () => {
    let s = applyTaskAction(base, { action: "add", kind: "research", text: "親戚の連絡先", shared: false }, 1);
    const id = s.familyTasks![0]!.id;
    expect(() => markDoneByFamily(s, id, true)).toThrow();
    s = applyTaskAction(s, { action: "share", id, shared: true }, 2);
    expect(markDoneByFamily(s, id, true).familyTasks![0]!.done).toBe(true);
    s = applyTaskAction(s, { action: "remove", id }, 3);
    expect(() => applyTaskAction(s, { action: "edit", id, text: "直す" }, 4)).toThrow();
  });
});
