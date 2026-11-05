import { describe, expect, test } from "vitest";
import type { CaseState } from "./case";
import { DEMO_CASE } from "./fixtures/demoCase";
import { ORDERS } from "./orders";
import { VENDOR_OF, assemblePaperwork, checkPaperwork, draftPaperwork, isSendable, paperworkPrompt, type PaperworkDraft } from "./paperwork";

const STATE: CaseState = {
  ...DEMO_CASE,
  decisions: {
    altar_plan: { value: "生花祭壇（小さめ）", status: "confirmed", utteranceIds: ["U5"] },
    flower_color: { value: "白と淡い紫", status: "confirmed", utteranceIds: [] },
    meals: { value: "通夜ぶるまい 15名分", status: "candidate", utteranceIds: [] },
  },
};

const DRAFT: PaperworkDraft = {
  summary: "入院が長かったお母さまを、身内だけで送りたいご家族です。",
  todos: [{ task: "菩提寺に日程を確認する", when: "今日中", decisionIds: ["temple"], utteranceIds: ["U3", "U99"] }],
  orders: [
    { orderId: "flowers", items: [{ name: "祭壇の生花", quantity: "一式", note: "白と淡い紫" }], deliverAt: "要確認", deliverTo: "会館", notes: "", utteranceIds: ["U2"] },
    { orderId: "meals", items: [{ name: "通夜ぶるまい", quantity: "15名分", note: "" }], deliverAt: "要確認", deliverTo: "要確認", notes: "", utteranceIds: [] },
    { orderId: "flowers", items: [{ name: "重複", quantity: "1", note: "" }], deliverAt: "", deliverTo: "", notes: "", utteranceIds: [] },
  ],
  askFamily: ["通夜ぶるまいの人数"],
};

describe("打合せの後の実務", () => {
  test("どの発注にも、発注書を送る業者が決まっている", () => {
    for (const o of ORDERS) expect(VENDOR_OF[o.id], o.id).toBeTruthy();
  });

  test("指示には、会話と決定の状態と発注の状態が入る", () => {
    const prompt = paperworkPrompt(STATE);
    expect(prompt).toContain("U2 喪主（長女）");
    expect(prompt).toContain("確定「白と淡い紫」");
    expect(prompt).toContain("候補「通夜ぶるまい 15名分」");
    expect(prompt).toContain("flowers（生花の発注）：発注できる");
  });

  test("確定した決定だけの発注は送れる、候補が残る発注は下書きにする。重複は1枚にまとめる", () => {
    const pw = assemblePaperwork(STATE, DRAFT, 1);
    expect(pw.sheets.map((s) => [s.orderId, s.status, s.vendor])).toEqual([
      ["flowers", "ready", "生花店"],
      ["meals", "waiting", "料理店"],
    ]);
  });

  test("書き起こしにない発言の id は落とし、今日決める未確定の項目を TODO に足す（迷いやすいものは1つずつ、ほかはまとめて1行）", () => {
    const pw = assemblePaperwork(STATE, DRAFT, 1);
    expect(pw.todos[0]!.utteranceIds).toEqual(["U3"]);
    const board = pw.todos.filter((t) => t.source === "board");
    expect(board.some((t) => t.task.includes("葬儀の形"))).toBe(true);
    expect(board.some((t) => t.task.includes("喪主を誰にするか"))).toBe(false);
    expect(board.at(-1)!.task).toMatch(/ほかに今日決める項目が \d+ 件/);
  });

  test("寺院・火葬場などの電話や予約で済む手配は、発注書にせず TODO に回す", () => {
    const withTemple = {
      ...DRAFT,
      orders: [...DRAFT.orders, { orderId: "temple_contact", items: [{ name: "ご逝去の連絡と日程の相談", quantity: "1件", note: "" }], deliverAt: "今日中", deliverTo: "", notes: "市外の菩提寺", utteranceIds: ["U5"] }],
    };
    const pw = assemblePaperwork(STATE, withTemple, 1);
    expect(pw.sheets.some((x) => x.orderId === "temple_contact")).toBe(false);
    const todo = pw.todos.find((t) => t.task.startsWith("寺院への連絡"))!;
    expect(todo).toMatchObject({ when: "今日中", source: "ai" });
    expect(todo.task).toContain("市外の菩提寺");
  });

  test("要確認の欄が残る発注書は、確定していても「送れる」にしない", () => {
    const pw = assemblePaperwork(STATE, DRAFT, 1);
    const flowers = pw.sheets.find((x) => x.orderId === "flowers")!;
    expect(flowers.blanks).toBe(1);
    expect(isSendable(flowers)).toBe(false);
    const filled = assemblePaperwork(STATE, { ...DRAFT, orders: [{ ...DRAFT.orders[0]!, deliverAt: "11月8日 10時" }] }, 1);
    expect(isSendable(filled.sheets[0]!)).toBe(true);
  });

  test("金額や上乗せの勧め、英語の文章は止める。数量は止めない", () => {
    expect(checkPaperwork(DRAFT)).toEqual([]);
    const priced = { ...DRAFT, orders: [{ ...DRAFT.orders[0]!, notes: "生花一式 55,000円" }] };
    expect(checkPaperwork(priced).map((v) => v.rule)).toContain("numbers_in_text");
    const upsell = { ...DRAFT, summary: "祭壇をグレードアップされてはいかがでしょう" };
    expect(checkPaperwork(upsell).map((v) => v.rule)).toContain("upsell");
  });

  test("点検に落ちたら1回だけ作り直し、それでも落ちたら出さない", async () => {
    let calls = 0;
    const bad = { ...DRAFT, summary: "Please prepare the flowers and meals for the family as soon as possible today." };
    const result = await draftPaperwork(STATE, async () => (++calls === 1 ? bad : DRAFT), 1);
    expect(result).toMatchObject({ ok: true, attempts: 2 });
    const never = await draftPaperwork(STATE, async () => bad, 1);
    expect(never.ok).toBe(false);
  });
});
