import { describe, expect, test } from "vitest";
import { agreementOf, rate } from "./agreement";
import { SCENES } from "./judgment-scenes";

describe("ベテランの答えとの一致", () => {
  test("一致した選択肢を数え、外れたものを答えと推奨の組で返す", () => {
    const scene = SCENES[0]!;
    const fits = new Map(Object.entries(scene.answer));
    fits.set("embalming", "not_now");
    fits.delete("yukan");
    const a = agreementOf(scene, fits);
    expect(a).toMatchObject({ matched: 2, total: 4 });
    expect(a.misses).toEqual([
      { id: "embalming", expected: "consider", actual: "not_now" },
      { id: "yukan", expected: "consider", actual: "missing" },
    ]);
  });

  test("全体の一致率を百分率で返す", () => {
    expect(rate([{ matched: 3, total: 4, misses: [] }, { matched: 1, total: 4, misses: [] }])).toBe(50);
    expect(rate([])).toBe(0);
  });

  test("場面は10件以上あり、どの場面も答えを持ち、費用のかからない選択肢を『今回は合わない』にしていない", () => {
    expect(SCENES.length).toBeGreaterThanOrEqual(10);
    for (const s of SCENES) {
      expect(Object.keys(s.answer).length).toBeGreaterThan(0);
      expect(s.answer.standard_laying).not.toBe("not_now");
    }
  });
});
