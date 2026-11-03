import { describe, expect, test } from "vitest";
import { DECISIONS } from "../domain/decisions";
import { confirmDecision } from "./extract";
import { STAFF_ONLY_DECISIONS, toFamilyView, UPCOMING_LIMIT } from "./familyView";
import { DEMO_CASE } from "./fixtures/demoCase";
import { acknowledgeRequest, addFamilyRequest } from "./requests";

const base = { ...DEMO_CASE, decisions: {}, requests: [] };

describe("遺族の窓口に渡す情報", () => {
  test("AI の候補は遺族に見せない。確定したものだけを見せる", () => {
    const withCandidate = { ...base, decisions: { funeral_style: { value: "家族葬", status: "candidate" as const, utteranceIds: ["U1"] } } };
    expect(toFamilyView(withCandidate).decided).toEqual([]);
    const view = toFamilyView(confirmDecision(withCandidate, "funeral_style", "家族葬"));
    expect(view.decided).toMatchObject([{ id: "funeral_style", value: "家族葬" }]);
  });

  test("会話の書き起こしや家族の事情は渡さない", () => {
    const json = JSON.stringify(toFamilyView(DEMO_CASE));
    for (const u of DEMO_CASE.utterances) expect(json).not.toContain(u.text);
    for (const c of DEMO_CASE.circumstances) expect(json).not.toContain(c.text);
    expect(json).not.toContain(DEMO_CASE.familyToken);
  });

  test("これから決めることは、前提が決まっているものに絞り、件数を区切る", () => {
    const view = toFamilyView(base);
    expect(view.upcoming.length).toBeLessThanOrEqual(UPCOMING_LIMIT);
    const ids = new Set(view.upcoming.map((u) => u.id));
    for (const d of DECISIONS.filter((x) => ids.has(x.id))) expect(d.dependsOn).toEqual([]);
    expect(view.upcoming.length + view.moreUpcoming).toBe(DECISIONS.length - STAFF_ONLY_DECISIONS.size);
  });

  test("担当者が確かめる項目（ご遺体の状態など）は遺族に見せない", () => {
    const confirmed = confirmDecision(base, "body_condition", "確認済み");
    const view = toFamilyView(confirmed);
    expect(view.decided.map((d) => d.id)).not.toContain("body_condition");
    expect(view.upcoming.map((u) => u.id)).not.toContain("body_condition");
  });

  test("今日決めることを先に並べる", () => {
    const view = toFamilyView(base);
    const firstLater = view.upcoming.findIndex((u) => !u.today);
    if (firstLater >= 0) expect(view.upcoming.slice(firstLater).every((u) => !u.today)).toBe(true);
  });
});

describe("変更の希望・質問", () => {
  test("届いた依頼は未対応で入り、決定そのものは変えない", () => {
    const confirmed = confirmDecision(base, "funeral_style", "家族葬");
    const next = addFamilyRequest(confirmed, { kind: "change", decisionId: "funeral_style", text: "やはり一日葬も考えたい", sentAt: 1 });
    expect(next.requests).toMatchObject([{ id: "Q1", status: "open", staffReply: null }]);
    expect(next.decisions.funeral_style).toEqual(confirmed.decisions.funeral_style);
  });

  test("変更の希望は、どの決定かが必要", () => {
    expect(() => addFamilyRequest(base, { kind: "change", decisionId: null, text: "変えたい", sentAt: 1 })).toThrow("どの決定");
  });

  test("空の内容・長すぎる内容・存在しない決定は受け付けない", () => {
    expect(() => addFamilyRequest(base, { kind: "question", decisionId: null, text: "   ", sentAt: 1 })).toThrow();
    expect(() => addFamilyRequest(base, { kind: "question", decisionId: null, text: "あ".repeat(501), sentAt: 1 })).toThrow();
    expect(() => addFamilyRequest(base, { kind: "question", decisionId: "no_such", text: "質問", sentAt: 1 })).toThrow();
  });

  test("担当者の返事は遺族の窓口に出る", () => {
    const sent = addFamilyRequest(base, { kind: "question", decisionId: null, text: "数珠は持参ですか", sentAt: 1 });
    const view = toFamilyView(acknowledgeRequest(sent, "Q1", "お持ちでなければ、こちらでご用意します"));
    expect(view.requests).toMatchObject([{ status: "acknowledged", staffReply: "お持ちでなければ、こちらでご用意します" }]);
  });

  test("元の状態は書き換えない", () => {
    const snapshot = JSON.stringify(base);
    addFamilyRequest(base, { kind: "question", decisionId: null, text: "質問", sentAt: 1 });
    expect(JSON.stringify(base)).toBe(snapshot);
  });
});
