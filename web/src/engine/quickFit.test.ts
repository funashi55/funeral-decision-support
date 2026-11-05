import { describe, expect, test } from "vitest";
import { FAREWELL_OPTIONS } from "../domain/farewell";
import { DEMO_CASE } from "./fixtures/demoCase";
import { QuickFitSchema, fitsChanged, quickFitPrompt, settleFits } from "./quickFit";

describe("いまの見立て", () => {
  test("見立ての形は、お別れの仕方の選択肢とすべて対応している", () => {
    expect(Object.keys(QuickFitSchema.shape.fits.shape).sort()).toEqual(FAREWELL_OPTIONS.map((o) => o.id).sort());
  });

  test("費用のかからない選択肢は「今回は合わない」にしない", () => {
    const fits = settleFits({ standard_laying: "not_now", yukan: "suits", embalming: "not_now", extend_resting: "consider" });
    expect(fits.standard_laying).toBe("consider");
    expect(fits.embalming).toBe("not_now");
  });

  test("返ってこなかった選択肢は「尋ねてみる」にして、勝手に外さない", () => {
    expect(settleFits({ standard_laying: "suits" }).yukan).toBe("consider");
  });

  test("見立てが変わったときだけ、理由づけを書き直す", () => {
    const a = settleFits({ standard_laying: "suits", yukan: "consider" });
    expect(fitsChanged(null, a)).toBe(true);
    expect(fitsChanged(a, { ...a })).toBe(false);
    expect(fitsChanged(a, { ...a, yukan: "suits" })).toBe(true);
  });

  test("指示には推奨と同じ材料（家族の発言・知見）が入る", () => {
    const prompt = quickFitPrompt(DEMO_CASE);
    expect(prompt).toContain("お風呂が好き");
    expect(prompt).toContain("R-record-02");
  });
});
