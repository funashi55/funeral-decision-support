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
      ...["trust", "trust", "trust", "trust", "trust", "trust"], // お悔やみ・関係性・亡くなるまでの流れ・お別れの様子
      ...["hearing", "hearing", "hearing", "hearing", "hearing"], // 好きだったこと・来てほしい人と親戚
      "schedule", // 孫の到着
      "farewell", // 顔を見てお別れさせたい
      ...["hearing", "hearing"], // お寺
      ...["schedule", "schedule"], // 火葬場の空き
      "plan",
      "logistics",
      // 後半：日程を決め直し、祭壇・料理・香典返しを決める
      "schedule", // お寺の都合を先に伺うべきでした
      "hearing", // お寺さんに電話した
      ...["schedule", "schedule"], // 通夜と葬儀の日時
      "plan", // 納棺の日時（愛用の品を入れる）
      "farewell", // 湯灌はしない
      ...["plan", "plan", "plan", "plan", "plan"], // 祭壇・花の色・料理・香典返し・香典とお悔やみ欄
      "schedule", // 火葬場へ行く人数
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
    const base = asUtterances(9);
    const fillers: Utterance[] = ["はい", "ええ", "そうですね"].map((t, i) => ({ id: `F${i}`, speaker: "family", speakerLabel: "家族", text: t, at: 200 + i }));
    expect(detectPhase([...base, ...fillers]).phase).toBe("hearing");
  });

  test("判定の根拠の発言を返す", () => {
    const r = detectPhase(asUtterances(18));
    expect(r.utteranceIds).toContain("U18");
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
