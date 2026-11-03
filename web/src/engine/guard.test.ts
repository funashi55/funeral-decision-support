import { describe, expect, test } from "vitest";
import { checkBudgetOption, checkText } from "./guard";

const rules = (text: string): string[] => checkText(text).map((v) => v.rule);

describe("不安をあおる言い回し", () => {
  test.each([
    "日にちが経つと菌が繁殖してしまいます",
    "このままだとお顔が変色するかもしれません",
    "匂いが出るとかわいそうなので",
    "状態は保証できないので湯灌をおすすめします",
  ])("「%s」は止める", (text) => {
    expect(rules(text)).toContain("fear_appeal");
  });

  test("できることを伝える穏やかな説明は通す", () => {
    expect(checkText("ご家族が手を添えて、お体を清めることに加われます。望まれるかをお尋ねください。")).toEqual([]);
  });
});

describe("多数派への同調圧力と、急がせる言い回し", () => {
  test("「皆さん選ばれています」は止める", () => {
    expect(rules("皆さん選ばれていますので安心です")).toContain("majority_pressure");
  });

  test("「最後だから」は止める", () => {
    expect(rules("最後だから立派に送ってあげましょう")).toContain("pressure_language");
  });
});

describe("文章への数字の混入", () => {
  test.each(["88,000円かかります", "22%の家族が選んでいます", "５人に1人が選びます", "約3万円の追加です"])("「%s」は止める", (text) => {
    expect(rules(text)).toContain("numbers_in_text");
  });

  test("日時や日数の言及は数字の混入とみなさない", () => {
    expect(rules("お孫さんが着くのは3日後なので、火葬を延ばす選択肢があります")).not.toContain("numbers_in_text");
  });
});

describe("費用を抑える選択肢", () => {
  test("費用を抑える選択肢が1つもなければ止める", () => {
    expect(checkBudgetOption([{ id: "yukan", lowCost: false }, { id: "embalming", lowCost: false }])).toHaveLength(1);
  });

  test("費用を抑える選択肢が含まれていれば通す", () => {
    expect(checkBudgetOption([{ id: "standard_laying", lowCost: true }, { id: "yukan", lowCost: false }])).toEqual([]);
  });
});
