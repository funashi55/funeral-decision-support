import { describe, expect, it } from "vitest";
import { addPhrase, emptyProfile, growth, orderCare, recordUsage, removePhrase, stylePrompt, withSettings } from "./buddy";

const base = emptyProfile("佐藤");

describe("バディの設定", () => {
  it("はじめは「ふつうに・全部見せる」で、話し方の指示を足さない", () => {
    expect(base.tone).toBe("plain");
    expect(base.amount).toBe("full");
    expect(stylePrompt(base)).toBe("");
  });

  it("言葉の調子を選ぶと、生成の指示に話し方が入る。勧める中身は変えないと書く", () => {
    const p = withSettings(base, { tone: "brief" });
    expect(stylePrompt(p)).toContain("短く端的");
    expect(stylePrompt(p)).toContain("勧める中身は変えない");
    expect(withSettings(p, {}).tone).toBe("brief");
  });
});

describe("自分の言い方", () => {
  it("新しいものを先頭に、同じものは寄せ、5つまで残す", () => {
    let p = base;
    for (const t of ["一", "二", "三", "四", "五", "六"].map((n) => `言い方${n}`)) p = addPhrase(p, "acceptance", t);
    p = addPhrase(p, "acceptance", "言い方三");
    expect(p.phrases.acceptance).toEqual(["言い方三", "言い方六", "言い方五", "言い方四", "言い方二"]);
    expect(base.phrases).toEqual({});
  });

  it("消すと、空になった考え方は取り除く", () => {
    const p = removePhrase(addPhrase(base, "acceptance", "ゆっくりで大丈夫です"), "acceptance", "ゆっくりで大丈夫です");
    expect(p.phrases).toEqual({});
  });

  it("短すぎる言い方は残さない", () => {
    expect(() => addPhrase(base, "acceptance", "あ")).toThrow();
  });

  it("話し方の指示に、自分の言い方を例として入れる", () => {
    expect(stylePrompt(addPhrase(base, "acceptance", "ゆっくりで大丈夫です"))).toContain("「ゆっくりで大丈夫です」");
  });
});

describe("使っていて育つ", () => {
  it("伝えた／使わなかったを数え、押し直しは前の数を戻す", () => {
    let p = recordUsage(base, "care:a", undefined, "told");
    p = recordUsage(p, "care:a", "told", "unused");
    expect(p.usage["care:a"]).toEqual({ told: 0, unused: 1 });
    p = recordUsage(p, "care:a", "unused", undefined);
    expect(p.usage["care:a"]).toEqual({ told: 0, unused: 0 });
  });

  it("寄り添いは、よく伝える考え方を前へ並べる（消さない）", () => {
    let p = recordUsage(base, "care:b", undefined, "told");
    p = recordUsage(p, "care:a", undefined, "unused");
    const items = [{ principleId: "a" }, { principleId: "b" }, { principleId: "c" }];
    expect(orderCare(p, items).map((x) => x.principleId)).toEqual(["b", "c", "a"]);
    expect(orderCare(null, items)).toEqual(items);
  });

  it("育ち具合を数える", () => {
    const p = addPhrase(recordUsage(base, "care:a", undefined, "told"), "a", "そばにいます");
    expect(growth(p)).toEqual({ told: 1, unused: 0, phrases: 1 });
  });
});
