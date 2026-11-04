/**
 * 遺族の窓口の案内役（Claude）。道具は3つだけ：
 *   read_record   … 決まったこと・これから決めること・送った依頼を読む（遺族の窓口と同じ範囲）
 *   leave_note    … 家族の検討メモを残す
 *   hand_to_staff … 担当者に回す
 * 決定を変える道具・推奨を作る道具は持たせない。確定や評価は構造上できない。
 *
 * グリーフケアの観点：つらい気持ちは受け止め、診断や助言をせず、担当者や相談先へつなぐ。
 */
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { DECISIONS } from "../domain/decisions";
import { appendAudit } from "./audit";
import type { CaseState, ChatTurn } from "./case";
import { toFamilyView } from "./familyView";
import { checkText } from "./guard";
import { addFamilyRequest } from "./requests";

export const CHAT_TEXT_MAX = 400;
export const NOTE_TEXT_MAX = 300;
/** 1回の問いかけで道具を使える回数 */
export const MAX_TOOL_STEPS = 4;
/** 案内役に渡す過去のやりとり */
export const HISTORY_TURNS = 10;
/** 1件の案件で受け付けるやりとりの上限 */
export const CHAT_LIMIT = 200;

export const FAMILY_CHAT_SYSTEM = `あなたは葬儀社の「ご家族の窓口」の案内役です。大切な方を亡くしたばかりのご家族とお話しします。

できること：
- 担当者と決めたこと・これから決めること・送った依頼を、read_record で読んでお伝えする
- ご家族が考えたいことを、leave_note で検討メモに残す
- 担当者にしか答えられないこと、変えたいこと、つらいお気持ちは、hand_to_staff で担当者に回す

してはいけないこと：
- 決定を変える、確定する、決めたと伝える（変えたいときは担当者に回す）
- どれが良いか評価する、勧める、比べて選ぶよう促す（「おすすめ」「〜したほうがいい」と言わない）
- 金額や割合、似た家族の数字を書く。値段の質問は担当者に回す
- お体の変化や、急がないと間に合わないといった不安をあおる話
- 医療・心理の診断や助言

話し方：
- 短く、やわらかい言葉で。一度に伝えることは一つか二つ
- 記録にないことは推測せず、「担当者に確かめます」と伝えて回す
- 「何もしてあげられなかった」などのつらいお気持ちには、まず気持ちを受け止める。励ましや評価をせず、担当者に回してよいかを尋ねる。今すぐ誰かと話したい様子なら、担当者に回したうえで、各地の「よりそいホットライン」などの相談窓口もあることを伝える
- 時刻は記録にある書き方のまま伝える`;

const ReadSchema = z.object({ section: z.enum(["decided", "upcoming", "requests", "all"]) });
const NoteSchema = z.object({ text: z.string().trim().min(1).max(NOTE_TEXT_MAX) });
const HandSchema = z.object({
  kind: z.enum(["question", "change"]),
  decisionId: z.string().nullable(),
  summary: z.string().trim().min(1).max(500),
  reason: z.enum(["question", "change", "feelings"]),
});

export const FAMILY_CHAT_TOOLS: Anthropic.Tool[] = [
  {
    name: "read_record",
    description: "ご家族の窓口に表示されている内容を読む。担当者と確定したこと、これから決めること、ご家族が送った依頼と担当者の返事。AI の候補や会話の書き起こしは含まれない",
    input_schema: { type: "object", properties: { section: { type: "string", enum: ["decided", "upcoming", "requests", "all"] } }, required: ["section"] },
  },
  {
    name: "leave_note",
    description: `ご家族が考えたいこと・覚えておきたいことを検討メモに残す。メモはご家族の窓口に表示され、決定は変わらない。${NOTE_TEXT_MAX}文字以内`,
    input_schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  },
  {
    name: "hand_to_staff",
    description: "担当者に回す。担当者にしか答えられない質問、決まったことを変えたいという希望、つらいお気持ちを伝えたいとき。決定は変わらず、担当者がご家族と話して決める",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["question", "change"] },
        decisionId: { type: ["string", "null"], enum: [...DECISIONS.map((d) => d.id), null], description: "変えたい決定。決定に紐づかなければ null" },
        summary: { type: "string", description: "担当者に伝える内容。ご家族の言葉をできるだけそのまま" },
        reason: { type: "string", enum: ["question", "change", "feelings"] },
      },
      required: ["kind", "decisionId", "summary", "reason"],
    },
  },
];

/** 案内役を呼ぶ関数。テストでは差し替える */
export type ChatModel = (req: { system: string; messages: Anthropic.MessageParam[]; tools: Anthropic.Tool[] }) => Promise<{
  readonly content: readonly Anthropic.ContentBlock[];
  readonly stop_reason: string | null;
}>;

/** 窓口の案内役に特有の止める言い回し（勧める・評価する） */
const RECOMMEND_PATTERNS = [/おすすめ/, /お勧め/, /オススメ/, /したほうが(?:いい|よい|良い)/, /した方が(?:いい|よい|良い)/, /選ぶべき/, /のがよいでしょう/, /のが良いでしょう/, /確定しました/, /変更しました/];

export function checkChatReply(text: string): string[] {
  const issues = checkText(text).map((v) => v.message);
  for (const p of RECOMMEND_PATTERNS) {
    const m = p.exec(text);
    if (m) issues.push(`窓口が勧めたり確定したりする言い回し「${m[0]}」です`);
  }
  return issues;
}

/** 案内役の返事が守る線を外したときに代わりに出す文 */
export const SAFE_REPLY = "ありがとうございます。この件は、担当者からきちんとお伝えしたいので、担当者にお伝えしておきますね。";
/** 案内役が使えないときの文 */
export const UNAVAILABLE_REPLY = "ただいま案内役がお返事できません。お手数ですが、下の「担当者に送る」からお送りください。";

interface ToolOutcome {
  readonly state: CaseState;
  readonly result: string;
  readonly handedOff: boolean;
  readonly isError: boolean;
}

export function runTool(state: CaseState, name: string, input: unknown, now: number): ToolOutcome {
  try {
    if (name === "read_record") {
      const { section } = ReadSchema.parse(input);
      const view = toFamilyView(state);
      const picked = section === "all" ? { decided: view.decided, upcoming: view.upcoming, requests: view.requests } : { [section]: view[section] };
      return { state, result: JSON.stringify(picked), handedOff: false, isError: false };
    }
    if (name === "leave_note") {
      const { text } = NoteSchema.parse(input);
      const note = { id: `N${state.familyNotes.length + 1}`, text, at: now };
      return { state: { ...state, familyNotes: [...state.familyNotes, note] }, result: "検討メモに残しました", handedOff: false, isError: false };
    }
    if (name === "hand_to_staff") {
      const h = HandSchema.parse(input);
      const decisionId = h.kind === "change" ? h.decisionId : h.decisionId;
      const added = addFamilyRequest(state, { kind: h.kind, decisionId, text: h.summary, sentAt: now });
      const request = added.requests.at(-1);
      const summary = h.reason === "feelings" ? "窓口の案内役が、ご家族のお気持ちを担当者に回した" : "窓口の案内役が、ご家族の依頼を担当者に回した";
      const next = appendAudit(added, { at: now, actor: "ai", kind: "family_chat_handoff", summary, refs: [request?.id ?? ""] });
      return { state: next, result: "担当者に伝えました。担当者の返事は窓口に表示されます", handedOff: true, isError: false };
    }
    return { state, result: `知らない道具です: ${name}`, handedOff: false, isError: true };
  } catch (e) {
    return { state, result: e instanceof Error ? e.message : "道具の入力が正しくありません", handedOff: false, isError: true };
  }
}

function historyMessages(turns: readonly ChatTurn[]): Anthropic.MessageParam[] {
  // 担当者に回したことを案内役が覚えていないと、同じ依頼を何度も回してしまう
  return turns.slice(-HISTORY_TURNS).map((t) => ({
    role: t.role === "family" ? "user" : "assistant",
    content: t.handedOff ? `${t.text}\n（この件は hand_to_staff で担当者に回し済み。もう一度回さない）` : t.text,
  }));
}

export class ChatInputError extends Error {}

/**
 * ご家族の問いかけに答える。道具で状態を変えた結果と、やりとりを足した状態を返す。
 * 返事が守る線を外したら、担当者に回したうえで決まった文に差し替える。
 */
export async function runFamilyChat(state: CaseState, message: string, model: ChatModel, now: number = Date.now()): Promise<CaseState> {
  const text = message.trim();
  if (!text) throw new ChatInputError("内容を入力してください");
  if (text.length > CHAT_TEXT_MAX) throw new ChatInputError(`${CHAT_TEXT_MAX}文字以内で入力してください`);
  if (state.familyChat.length >= CHAT_LIMIT) throw new ChatInputError("これ以上お送りできません。担当者に直接お声がけください");

  const familyTurn: ChatTurn = { id: `T${state.familyChat.length + 1}`, role: "family", text, at: now, handedOff: false };
  let current: CaseState = state;
  let handedOff = false;
  const messages: Anthropic.MessageParam[] = [...historyMessages(state.familyChat), { role: "user", content: text }];
  let reply = "";

  for (let step = 0; step <= MAX_TOOL_STEPS; step++) {
    const response = await model({ system: FAMILY_CHAT_SYSTEM, messages, tools: FAMILY_CHAT_TOOLS });
    if (response.stop_reason === "refusal") break;
    const uses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    reply = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    if (response.stop_reason !== "tool_use" || uses.length === 0 || step === MAX_TOOL_STEPS) break;
    messages.push({ role: "assistant", content: response.content as Anthropic.ContentBlockParam[] });
    const results: Anthropic.ToolResultBlockParam[] = uses.map((u) => {
      const out = runTool(current, u.name, u.input, now);
      current = out.state;
      handedOff = handedOff || out.handedOff;
      return { type: "tool_result", tool_use_id: u.id, content: out.result, is_error: out.isError };
    });
    messages.push({ role: "user", content: results });
  }

  if (!reply || checkChatReply(reply).length > 0) {
    if (!handedOff) {
      const out = runTool(current, "hand_to_staff", { kind: "question", decisionId: null, summary: `窓口でのご質問：${text}`, reason: "question" }, now);
      current = out.state;
      handedOff = true;
    }
    reply = SAFE_REPLY;
  }

  const assistantTurn: ChatTurn = { id: `T${state.familyChat.length + 2}`, role: "assistant", text: reply, at: now, handedOff };
  return { ...current, familyChat: [...state.familyChat, familyTurn, assistantTurn] };
}
