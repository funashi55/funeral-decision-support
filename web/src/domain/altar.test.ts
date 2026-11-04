import { describe, expect, test } from "vitest";
import manifest from "../data/altar-images.json";
import { ALTAR_PALETTES, altarImageFor, paletteFor } from "./altar";

describe("祭壇イメージ", () => {
  test("生花の色合いの言葉から色合いを選び、当てはまらなければ白にする", () => {
    expect(paletteFor("淡いピンク系で").id).toBe("pink");
    expect(paletteFor("母の好きな紫を入れて").id).toBe("purple");
    expect(paletteFor("おまかせ").id).toBe("white");
    expect(paletteFor(undefined).id).toBe("white");
  });

  test("検品に落ちたイメージ・検品していないイメージは出さない", () => {
    expect(altarImageFor("pink", [{ id: "pink", passed: false }])).toBeNull();
    expect(altarImageFor("pink", [])).toBeNull();
    expect(altarImageFor("pink", [{ id: "pink", passed: true }])).toBe("/altar/pink.webp");
  });

  test("すべての色合いが検品を通っている（通っていなければ npm run altar:check で直す）", () => {
    for (const p of ALTAR_PALETTES) expect(manifest.images.find((i) => i.id === p.id)?.passed, p.id).toBe(true);
  });
});
