/**
 * 遺族との打合せのロールプレイ。
 * 1. 打合せ：Claude がご遺族を演じ、担当者が打合せをする。担当者のお悔やみから始まり、ご遺族は聞かれたことに答える
 * 2. 取り出し：会話から「こういう時はこうする」を、担当者の元の発言つきで取り出す。元の発言に戻れないものは捨てる
 *
 * 状態はブラウザが持ち、サーバーは毎回届いた会話を検査してから次の一手だけを返す。
 * モデルの呼び出しは引数で受け取り、テストでは差し替える。
 */
import { z } from "zod";
import type { HearingScene } from "../data/hearingScenes";

export const TURN_TEXT_MAX = 800;
export const TURNS_MAX = 80;

export const HearingTurnSchema = z.object({
  role: z.enum(["veteran", "family"]),
  speaker: z.string().max(20),
  text: z.string().trim().min(1).max(TURN_TEXT_MAX),
});
export type HearingTurn = z.infer<typeof HearingTurnSchema>;

export const HearingTurnsSchema = z.array(HearingTurnSchema).max(TURNS_MAX);

export class HearingInputError extends Error {}

// ---- ご遺族役 ----

export const FamilyReplySchema = z.object({
  lines: z
    .array(z.object({ speaker: z.string().describe("話す家族の呼び名（指定の一覧から）"), text: z.string().describe("その人のせりふ。1〜3文") }))
    .describe("担当者の発言に続く家族のせりふ。ふつうは1人、多くても2人"),
  revealed: z.array(z.string()).describe("このせりふで初めて話した隠れた事情の ID。なければ空"),
});
export type FamilyReply = z.infer<typeof FamilyReplySchema>;

export function familySystem(scene: HearingScene): string {
  const members = scene.family.map((m) => `- ${m.label}：${m.persona}`).join("\n");
  const hidden = scene.hidden.map((h) => `- ${h.id}（${h.heldBy}が知っている）：${h.fact}\n  話す条件：${h.revealWhen}`).join("\n");
  const opening = scene.opening.map((l) => `- ${l.speaker}「${l.text}」`).join("\n");
  return `あなたは葬儀の打合せのロールプレイで、ご遺族を演じます。相手は葬儀社の担当者です。
ここは葬儀会館の打合せ室です。ご家族は大切な人を亡くしたばかりで、担当者と初めて向き合っています。本物のご遺族として、その場にいるように振る舞ってください。

## 場面（担当者も知っている事実）
${scene.card.map((c) => `- ${c}`).join("\n")}

## 演じる家族
${members}

## 家族だけが知っている事情（自分からは言わない）
${hidden}

## 打合せの始まりのご家族の様子
担当者が最初に声をかけたら、たとえば次のような気持ちで応える（言い回しは担当者の言葉に合わせて変えてよい）。
${opening}

## 守ること
- せりふは話し言葉で、1人1〜3文。担当者の発言に応じて、いちばん自然な人が答える。黙っている人がいてよい
- 事情は、担当者がその条件に当たることを尋ねたときだけ話す。尋ねられていないのに先回りして話さない。条件に当たったら、無理に隠さず自然に話す
- 上に書いていない事実（病名、名前、地名、金額、過去の出来事など）を作らない。尋ねられて答えがないときは「さあ……そこまでは」「考えたことがなかったです」のように、わからないと答える
- 担当者に助言したり、打合せの進め方を評価したりしない。家族として反応するだけにする
- 葬儀の用語や段取りはよく知らない。担当者の説明に沿って進み、わからないことは素直に聞き返す
- 担当者の提案には、その人の気持ちのとおりに反応する（納得する、迷う、反対する）。無理に同意しない
- 練習であることや、AI であることには触れない
- 実在の人や会社の名前が出ても、話題にせずに家族として受け流す`;
}

// ---- 取り出し ----

export const ExtractedJudgmentSchema = z.object({
  when: z.string().describe("どんなとき（家族の様子・条件）"),
  do: z.string().describe("担当者はどうする・どう言う"),
  why: z.string().describe("担当者がこの判断の理由として自分で話したことだけ。ほかの発言をつなげて理由を推し量らない。話していなければ空文字"),
  quote: z.string().describe("根拠にした担当者の発言の一部を、一字一句そのまま引用（20〜80字）"),
});
export const ExtractionSchema = z.object({
  judgments: z.array(ExtractedJudgmentSchema).describe("担当者の判断。3〜8件"),
  firstWords: z.string().describe("担当者が最初にかけた言葉をそのまま。なければ空文字"),
});
export type ExtractedJudgment = z.infer<typeof ExtractedJudgmentSchema>;
export type Extraction = z.infer<typeof ExtractionSchema>;

export const EXTRACT_SYSTEM = `あなたは、葬儀の担当者とご遺族の打合せ（ロールプレイ）の記録から、担当者の判断を取り出す役です。
「こういうときは、こうする（こう言う）」の形で書き、必ず担当者本人の発言を一字一句そのまま引用して根拠にしてください。
- 担当者が言っていないこと、ご家族が言ったことを、担当者の判断として書かない
- 一般論や教科書的なまとめにしない。この人の言葉と順番に出た、具体的なやり方を書く
- 理由（why）は、担当者がその判断の理由を口にしたときだけ書く。別の話題の発言を理由に結びつけない
- 高いプランや有料の選択肢を勧めることそのものは、判断として取り出さない（家族の望みを確かめる尋ね方は取り出してよい）
- 実在の人や会社の名前は書かない`;

/** 引用を照らし合わせるために、空白と句読点の違いをならす */
function squash(text: string): string {
  return text.replace(/[\s、。，．,.！？!?「」『』（）()・…ー〜~]/g, "");
}

/** 引用が担当者本人の発言のどれかに含まれるか。ご家族の発言は根拠にならない */
export function quoteFromVeteran(quote: string, turns: readonly HearingTurn[]): boolean {
  const q = squash(quote);
  if (q.length < 4) return false;
  return turns.some((t) => t.role === "veteran" && squash(t.text).includes(q));
}

/** 元の発言に戻れない判断を捨てる。捨てた件数も返す */
export function keepGrounded(extraction: Extraction, turns: readonly HearingTurn[]): { readonly extraction: Extraction; readonly dropped: number } {
  const judgments = extraction.judgments.filter((j) => quoteFromVeteran(j.quote, turns));
  const firstWords = extraction.firstWords && quoteFromVeteran(extraction.firstWords, turns) ? extraction.firstWords : "";
  return { extraction: { judgments, firstWords }, dropped: extraction.judgments.length - judgments.length };
}

// ---- 会話の組み立てと検査 ----

export function transcriptText(turns: readonly HearingTurn[]): string {
  return turns.map((t) => `${t.role === "veteran" ? "担当者" : t.speaker}：${t.text}`).join("\n");
}

/** 会話を、ご遺族役のモデルに渡す形にする（ご家族＝assistant、担当者＝user）。担当者の言葉から始まる */
export function familyMessages(turns: readonly HearingTurn[]): { role: "user" | "assistant"; content: string }[] {
  const messages: { role: "user" | "assistant"; content: string }[] = [];
  for (const t of turns) {
    const role = t.role === "veteran" ? "user" : "assistant";
    const content = t.role === "veteran" ? t.text : `${t.speaker}：${t.text}`;
    const last = messages.at(-1);
    if (last && last.role === role) messages[messages.length - 1] = { role, content: `${last.content}\n${content}` };
    else messages.push({ role, content });
  }
  return messages;
}

/** ご遺族役の返事を検査する：知らない呼び名のせりふと、存在しない事情の ID を落とす */
export function sanitizeFamilyReply(scene: HearingScene, reply: FamilyReply): FamilyReply {
  const labels = new Set(scene.family.map((m) => m.label));
  const hiddenIds = new Set(scene.hidden.map((h) => h.id));
  const lines = reply.lines
    .map((l) => ({ speaker: l.speaker.replace(/[：:].*$/, "").trim(), text: l.text.trim() }))
    .filter((l) => labels.has(l.speaker) && l.text.length > 0)
    .slice(0, 3);
  return { lines, revealed: reply.revealed.filter((id) => hiddenIds.has(id)) };
}

export function lastIsVeteran(turns: readonly HearingTurn[]): boolean {
  return turns.at(-1)?.role === "veteran";
}

// ---- モデルの差し替え口 ----

export type FamilyModel = (system: string, messages: { role: "user" | "assistant"; content: string }[]) => Promise<FamilyReply>;
export type ExtractModel = (system: string, prompt: string) => Promise<Extraction>;

export async function nextFamilyLines(scene: HearingScene, turns: readonly HearingTurn[], model: FamilyModel): Promise<FamilyReply> {
  if (!lastIsVeteran(turns)) throw new HearingInputError("担当者の発言のあとにご家族が答えます");
  const reply = await model(familySystem(scene), familyMessages(turns));
  const clean = sanitizeFamilyReply(scene, reply);
  if (clean.lines.length === 0) return { lines: [{ speaker: scene.family[0]?.label ?? "家族", text: "……はい。" }], revealed: [] };
  return clean;
}

export async function extractJudgments(
  scene: HearingScene,
  turns: readonly HearingTurn[],
  model: ExtractModel,
): Promise<{ readonly extraction: Extraction; readonly dropped: number }> {
  if (!turns.some((t) => t.role === "veteran")) throw new HearingInputError("担当者の発言がまだありません");
  const prompt = `## 場面\n${scene.card.join("\n")}\n\n## 打合せの記録\n${transcriptText(turns)}`;
  return keepGrounded(await model(EXTRACT_SYSTEM, prompt), turns);
}
