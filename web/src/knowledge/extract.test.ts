import { describe, expect, test } from "vitest";
import { mergeFragments, normalize, traceToTranscript, type Fragment } from "./extract";
import { loadKnowledge } from "./rules";

const TRANSCRIPT = `聞き手：火葬を急ぎたいと言われたら、どうしますか。
ベテラン：まず、なんで急ぎたいのかを聞くんです。体が心配で、っていう方が多いので、
日を延ばしてもゆっくりお別れできる方法がありますよ、と伝えます。
ベテラン：お悔やみ欄はね、載せる前に、まだ知らせてない親戚がいないか必ず聞きます。`;

const fragments: Fragment[] = [
  {
    theme: "farewell",
    rules: [
      {
        when: "火葬を急ぎたいと言われたとき",
        do: "急ぐ理由を尋ね、日を延ばしてもお別れできる方法を伝える",
        why: "保存の心配だけで急いでいることがある",
        quote: "まず、なんで急ぎたいのかを聞くんです",
        decisionIds: ["cremation_date"],
      },
    ],
  },
  {
    theme: "logistics",
    rules: [
      { when: "お悔やみ欄の話が出たとき", do: "掲載の前に、知らせていない親族がいないか聞く", why: "掲載は取り消せない", quote: "載せる前に、まだ知らせてない親戚がいないか必ず聞きます", decisionIds: ["obituary"] },
      { when: "重複", do: "重複", why: "重複", quote: "載せる前に まだ知らせてない親戚がいないか必ず聞きます。", decisionIds: ["obituary"] },
    ],
  },
];

describe("聞き取りからの知見の取りまとめ", () => {
  test("断片をまとめ、テーマごとに id を振り、重複を除く", () => {
    const k = mergeFragments(fragments, "interview-1", "聞き取り");
    expect(k.rules.map((r) => r.id)).toEqual(["R-farewell-01", "R-logistics-01"]);
    expect(k.rules.every((r) => r.origin === "veteran_interview")).toBe(true);
  });

  test("すべての規則が、文字起こしの元の発言に戻れる", () => {
    const k = mergeFragments(fragments, "interview-1", "聞き取り");
    expect(traceToTranscript(k, TRANSCRIPT)).toEqual([]);
  });

  test("文字起こしにない発言を元にした規則は見つけ出す", () => {
    const bad: Fragment = { theme: "plan", rules: [{ when: "w", do: "d", why: "y", quote: "高いプランを勧めるべきです", decisionIds: ["altar_plan"] }] };
    const k = mergeFragments([bad], "x", "x");
    expect(traceToTranscript(k, TRANSCRIPT)).toHaveLength(1);
  });

  test("作者のメモ由来の規則は、文字起こしとは照合しない", () => {
    expect(traceToTranscript(loadKnowledge(), TRANSCRIPT)).toEqual([]);
  });

  test("存在しない決定項目を指す断片は弾く", () => {
    const bad = { theme: "plan", rules: [{ when: "w", do: "d", why: "y", quote: "まず、なんで", decisionIds: ["unknown"] }] } as unknown as Fragment;
    expect(() => mergeFragments([bad], "x", "x")).toThrow();
  });

  test("比べるときは句読点と空白の違いを無視する", () => {
    expect(normalize("載せる前に、まだ。")).toBe(normalize("載せる前に まだ"));
  });
});
