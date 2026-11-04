import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, test, vi } from "vitest";
import type { CaseState } from "./case";
import { CHAT_TEXT_MAX, FAMILY_CHAT_TOOLS, SAFE_REPLY, checkChatReply, runFamilyChat, runTool, type ChatModel } from "./familyChat";
import { DEMO_CASE } from "./fixtures/demoCase";

const base: CaseState = {
  ...DEMO_CASE,
  decisions: {
    funeral_style: { value: "家族葬", status: "confirmed", utteranceIds: [] },
    laying_in_style: { value: "湯灌（候補）", status: "candidate", utteranceIds: [] },
  },
};

type Block = Anthropic.ContentBlock;
const text = (t: string): Block => ({ type: "text", text: t, citations: null }) as Block;
const tool = (id: string, name: string, input: unknown): Block => ({ type: "tool_use", id, name, input, caller: { type: "direct" } }) as unknown as Block;

/** 決めた順に応答を返す偽の案内役 */
function scripted(...responses: { content: Block[]; stop_reason: string }[]): ChatModel {
  const fn = vi.fn();
  for (const r of responses) fn.mockResolvedValueOnce(r);
  return fn as unknown as ChatModel;
}

describe("案内役の道具", () => {
  test("道具は3つだけで、決定を変える道具はない", () => {
    expect(FAMILY_CHAT_TOOLS.map((t) => t.name)).toEqual(["read_record", "leave_note", "hand_to_staff"]);
  });

  test("記録を読む道具は、確定したことだけを返し、候補を含めない", () => {
    const out = runTool(base, "read_record", { section: "all" }, 0);
    expect(out.result).toContain("家族葬");
    expect(out.result).not.toContain("湯灌（候補）");
  });

  test("検討メモを残しても、決定は変わらない", () => {
    const out = runTool(base, "leave_note", { text: "孫の到着の時刻を確かめる" }, 5);
    expect(out.state.familyNotes).toEqual([{ id: "N1", text: "孫の到着の時刻を確かめる", at: 5 }]);
    expect(out.state.decisions).toBe(base.decisions);
  });

  test("担当者に回すと依頼になり、監査ログに残る。決定は変わらない", () => {
    const out = runTool(base, "hand_to_staff", { kind: "change", decisionId: "funeral_style", summary: "一日葬に変えたい", reason: "change" }, 5);
    expect(out.handedOff).toBe(true);
    expect(out.state.requests.at(-1)).toMatchObject({ kind: "change", decisionId: "funeral_style", text: "一日葬に変えたい", status: "open" });
    expect(out.state.audit.at(-1)?.kind).toBe("family_chat_handoff");
    expect(out.state.decisions.funeral_style?.value).toBe("家族葬");
  });

  test("知らない道具や不正な入力は、誤りとして返し状態を変えない", () => {
    expect(runTool(base, "confirm_decision", {}, 0)).toMatchObject({ isError: true, state: base });
    expect(runTool(base, "hand_to_staff", { kind: "change", decisionId: null, summary: "x", reason: "change" }, 0)).toMatchObject({ isError: true });
  });
});

describe("窓口でのやりとり", () => {
  test("道具を使ってから答え、やりとりを記録する", async () => {
    const model = scripted(
      { content: [tool("t1", "read_record", { section: "decided" })], stop_reason: "tool_use" },
      { content: [text("葬儀の形は、家族葬に決まっています。")], stop_reason: "end_turn" },
    );
    const next = await runFamilyChat(base, "葬儀の形はどうなりましたか", model, 10);
    expect(next.familyChat.map((t) => [t.role, t.text])).toEqual([
      ["family", "葬儀の形はどうなりましたか"],
      ["assistant", "葬儀の形は、家族葬に決まっています。"],
    ]);
  });

  test("道具の結果を、次の呼び出しで案内役に渡す", async () => {
    const model = vi.fn<ChatModel>()
      .mockResolvedValueOnce({ content: [tool("t1", "read_record", { section: "decided" })], stop_reason: "tool_use" })
      .mockResolvedValueOnce({ content: [text("家族葬です。")], stop_reason: "end_turn" });
    await runFamilyChat(base, "決まったことは", model, 10);
    const second = model.mock.calls[1]?.[0].messages.at(-1);
    expect(JSON.stringify(second)).toContain("tool_result");
    expect(JSON.stringify(second)).toContain("家族葬");
  });

  test("勧める返事は出さず、担当者に回して決まった文に差し替える", async () => {
    const model = scripted({ content: [text("湯灌がおすすめです。")], stop_reason: "end_turn" });
    const next = await runFamilyChat(base, "湯灌はしたほうがいいですか", model, 10);
    expect(next.familyChat.at(-1)).toMatchObject({ text: SAFE_REPLY, handedOff: true });
    expect(next.requests.at(-1)?.text).toContain("湯灌はしたほうがいいですか");
  });

  test("金額を書いた返事も出さない", async () => {
    const model = scripted({ content: [text("湯灌は88,000円です。")], stop_reason: "end_turn" });
    const next = await runFamilyChat(base, "湯灌はいくら", model, 10);
    expect(next.familyChat.at(-1)?.text).toBe(SAFE_REPLY);
  });

  test("道具を何度も使い続けても、決まった回数で打ち切る", async () => {
    const loop = vi.fn<ChatModel>().mockResolvedValue({ content: [tool("t", "read_record", { section: "all" })], stop_reason: "tool_use" });
    const next = await runFamilyChat(base, "教えて", loop, 10);
    expect(loop.mock.calls.length).toBeLessThanOrEqual(5);
    expect(next.familyChat.at(-1)?.text).toBe(SAFE_REPLY);
  });

  test("担当者に回し済みであることを、次の問いかけの履歴で案内役に伝える", async () => {
    const first = await runFamilyChat(base, "湯灌はいくら", scripted({ content: [text("湯灌は88,000円です。")], stop_reason: "end_turn" }), 10);
    const model = vi.fn<ChatModel>().mockResolvedValue({ content: [text("承知しました。")], stop_reason: "end_turn" });
    await runFamilyChat(first, "ありがとう", model, 11);
    const history = JSON.stringify(model.mock.calls[0]?.[0].messages);
    expect(history).toContain("回し済み");
  });

  test("空の問いかけや長すぎる問いかけは受け付けない", async () => {
    const model = scripted();
    await expect(runFamilyChat(base, "  ", model)).rejects.toThrow();
    await expect(runFamilyChat(base, "あ".repeat(CHAT_TEXT_MAX + 1), model)).rejects.toThrow();
  });
});

describe("案内役の返事の検査", () => {
  test.each(["こちらがおすすめです", "通夜はしたほうがいいですよ", "家族葬に変更しました", "多くの方が湯灌を選ばれます"])("止める：%s", (t) => {
    expect(checkChatReply(t).length).toBeGreaterThan(0);
  });
  test.each(["火葬は11月10日の10時に決まっています", "お気持ち、お察しします。担当者にお伝えしてもよろしいですか", "検討メモに残しました"])("止めない：%s", (t) => {
    expect(checkChatReply(t)).toEqual([]);
  });
});
