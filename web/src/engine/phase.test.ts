import { describe, expect, test } from "vitest";
import type { Utterance } from "./case";
import { DEMO_CASE } from "./fixtures/demoCase";
import { DEMO_SCRIPT } from "./fixtures/demoScript";
import { allowsPrices, detectPhase, focusDecisions } from "./phase";

const asUtterances = (n: number): Utterance[] =>
  DEMO_SCRIPT.slice(0, n).map((l, i) => ({ id: `U${i + 1}`, speaker: l.speaker, speakerLabel: l.speakerLabel, text: l.text, at: i * 20 }));

describe("打合せの段階の判定", () => {
  test("デモ台本の各場面で、正しい段階を判定する", () => {
    const expected = [
      ...["trust", "trust", "trust", "trust"], // お悔やみ・経緯・お別れの様子
      ...["hearing", "hearing", "hearing", "hearing", "hearing"], // 人柄・来てほしい人
      "schedule", // 孫の到着
      "farewell", // 顔を見てお別れさせたい
      ...["hearing", "hearing"], // お寺
      ...["schedule", "schedule"], // 火葬場の空き
      "plan",
      "logistics",
    ];
    const actual = DEMO_SCRIPT.map((_, i) => detectPhase(asUtterances(i + 1)).phase);
    expect(actual).toEqual(expected);
  });

  test("手がかりがなければ信頼関係から始める", () => {
    expect(detectPhase([]).phase).toBe("trust");
    expect(detectPhase([{ id: "U1", speaker: "staff", speakerLabel: "担当者", text: "よろしくお願いします", at: 0 }]).phase).toBe("trust");
  });

  test("手がかりのない相づちが続いても、直前の段階を保つ", () => {
    const base = asUtterances(5);
    const fillers: Utterance[] = ["はい", "ええ", "そうですね"].map((t, i) => ({ id: `F${i}`, speaker: "family", speakerLabel: "家族", text: t, at: 200 + i }));
    expect(detectPhase([...base, ...fillers]).phase).toBe("hearing");
  });

  test("判定の根拠の発言を返す", () => {
    const r = detectPhase(asUtterances(16));
    expect(r.utteranceIds).toContain("U16");
    expect(r.label).toBe("プランと費用");
  });

  test("信頼関係とヒアリングの段階では金額を出さない", () => {
    expect(allowsPrices("trust")).toBe(false);
    expect(allowsPrices("hearing")).toBe(false);
    expect(allowsPrices("farewell")).toBe(true);
    expect(allowsPrices("plan")).toBe(true);
  });

  test("段階の今日決める項目のうち、未確定のものを返す", () => {
    const ids = focusDecisions(DEMO_CASE, "farewell").map((d) => d.id);
    expect(ids).toContain("laying_in_style");
    expect(ids).not.toContain("face_viewing");
    const confirmed = { ...DEMO_CASE, decisions: { laying_in_style: { value: "湯灌", status: "confirmed" as const, utteranceIds: [] } } };
    expect(focusDecisions(confirmed, "farewell").map((d) => d.id)).not.toContain("laying_in_style");
  });
});
