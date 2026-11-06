import { describe, expect, it } from "vitest";
import type { CaseState, Utterance } from "./case";
import { DEMO_CASE } from "./fixtures/demoCase";
import { DEMO_SCRIPT } from "./fixtures/demoScript";
import { NEXT_STEPS_MAX, nextSteps } from "./nextSteps";
import { detectOversights } from "./oversight";

const lines = (n: number): Utterance[] =>
  DEMO_SCRIPT.slice(0, n).map((l, i) => ({ id: `U${i + 1}`, speaker: l.speaker, speakerLabel: l.speakerLabel, text: l.text, at: i * 20 }));
const at = (n: number, over: Partial<CaseState> = {}): CaseState => ({ ...DEMO_CASE, utterances: lines(n), decisions: {}, ...over });
const ids = (state: CaseState): string[] => nextSteps(state, detectOversights(state)).map((s) => s.item.id);

describe("次に進めること", () => {
  it("多くても決めた数だけ押し上げる", () => {
    expect(ids(at(19)).length).toBeLessThanOrEqual(NEXT_STEPS_MAX);
  });

  it("孫の到着の話が出たら、到着の見込みを押し上げる", () => {
    expect(ids(at(12))).toContain("relatives_arrival");
  });

  it("お寺の話のあと火葬場の空きの話が出たら、菩提寺の確認を押し上げる（見落とし注意）", () => {
    const steps = nextSteps(at(16), detectOversights(at(16)));
    const temple = steps.find((s) => s.item.id === "temple");
    expect(temple).toBeDefined();
  });

  it("確定した項目は押し上げない", () => {
    const state = at(12, { decisions: { relatives_arrival: { value: "3日後", status: "confirmed", utteranceIds: [] } } });
    expect(ids(state)).not.toContain("relatives_arrival");
  });

  it("候補が出ている項目は「確定する」として出す", () => {
    const state = at(12, { decisions: { relatives_arrival: { value: "孫が3日後に到着", status: "candidate", utteranceIds: ["U12"] } } });
    const step = nextSteps(state, detectOversights(state)).find((s) => s.item.id === "relatives_arrival");
    expect(step?.kind).toBe("confirm");
  });

  it("理由を一言添える", () => {
    for (const s of nextSteps(at(16), detectOversights(at(16)))) expect(s.reason.length).toBeGreaterThan(0);
  });
});
