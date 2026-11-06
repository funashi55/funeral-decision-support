/**
 * ベテランへの聞き取り（ロールプレイ）。
 * 1. ロールプレイ：Claude が家族を演じ、ベテランが担当者として打合せをする
 * 2. ふりかえり：聞き手役の Claude が、ベテラン本人の発言を引いて「なぜそうしたか」を尋ねる（クリティカル・ディシジョン法に倣う）
 * 3. 取り出し：会話から「こういう時はこうする」を、ベテランの元の発言つきで取り出す。元の発言に戻れないものは捨てる
 *
 * 状態はブラウザが持ち、サーバーは毎回届いた会話を検査してから次の一手だけを返す。
 * モデルの呼び出しは引数で受け取り、テストでは差し替える。
 */
import { z } from "zod";
import { DEBRIEF_FOCUS, type HearingScene } from "../data/hearingScenes";

export const TURN_TEXT_MAX = 800;
export const TURNS_MAX = 80;
/** ふりかえりで聞く数の上限 */
export const DEBRIEF_QUESTIONS = 3;

export const HearingTurnSchema = z.object({
  role: z.enum(["veteran", "family", "interviewer"]),
  speaker: z.string().max(20),
  text: z.string().trim().min(1).max(TURN_TEXT_MAX),
});
export type HearingTurn = z.infer<typeof HearingTurnSchema>;

export const HearingTurnsSchema = z.array(HearingTurnSchema).max(TURNS_MAX);

export class HearingInputError extends Error {}

// ---- 家族役 ----

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
  return `あなたは葬儀の打合せのロールプレイで、ご遺族を演じます。相手は経験豊富な葬儀の担当者（ベテラン）です。
この練習の目的は、ベテランが打合せで何をどの順で尋ね、どう声をかけるかを記録することです。演技がうまく進むことより、ベテランの判断が自然に出ることを大事にしてください。

## 場面（担当者も知っている事実）
${scene.card.map((c) => `- ${c}`).join("\n")}

## 演じる家族
${members}

## 家族だけが知っている事情（自分からは言わない）
${hidden}

## 守ること
- せりふは話し言葉で、1人1〜3文。担当者の発言に応じて、いちばん自然な人が答える。黙っている人がいてよい
- 事情は、担当者がその条件に当たることを尋ねたときだけ話す。尋ねられていないのに先回りして話さない。条件に当たったら、無理に隠さず自然に話す
- 上に書いていない事実（病名、名前、地名、金額、過去の出来事など）を作らない。尋ねられて答えがないときは「さあ……そこまでは」「考えたことがなかったです」のように、わからないと答える
- 担当者に助言したり、打合せの進め方を評価したりしない。家族として反応するだけにする
- 葬儀の用語や段取りはよく知らない。担当者の説明に沿って進み、わからないことは素直に聞き返す
- 担当者の提案には、その人の気持ちのとおりに反応する（納得する、迷う、反対する）。無理に同意しない
- 実在の人や会社の名前が出ても、話題にせずに家族として受け流す`;
}

// ---- ふりかえりの聞き手 ----

export const InterviewerReplySchema = z.object({
  question: z.string().describe("次に尋ねる一問だけ（問いは1つ、全体で100字以内）。ベテラン本人の発言を短く引いてから尋ねる。終わるときはお礼の一言"),
  done: z.boolean().describe("ふりかえりを終えるなら true"),
});
export type InterviewerReply = z.infer<typeof InterviewerReplySchema>;

export function interviewerSystem(): string {
  return `あなたは、葬儀のベテラン担当者から判断のコツを聞き取る聞き手です。いまベテランが、架空の家族とのロールプレイ（打合せ）を終えました。
会話の記録を読み、ベテラン本人の発言を短く引用しながら、なぜそうしたかを一問ずつ尋ねてください（熟練者の判断を後から聞くクリティカル・ディシジョン法に倣う）。

## 聞きたいこと（どの場面でも同じ。経験の違う担当者どうしで比べるため）
${DEBRIEF_FOCUS.map((f) => `- ${f}`).join("\n")}

## 尋ね方
- 一度に尋ねるのは一問だけ。「また」「あわせて」で問いを足さない。全体で100字以内にし、答えやすくする。「なぜ」だけでなく「そのとき何に気づいたか」「新人ならここで何をしがちか」「何がわかっていたら別の判断をしたか」も使う
- ベテランが実際に言ったこと・したことを引く。言っていないことを前提にしない
- 評価や感想（「素晴らしいですね」など）は言わない。お礼は最後に一度だけ
- ${DEBRIEF_QUESTIONS}問尋ねたら、または十分に聞けたら done を true にして、お礼の一言で終える
- 実在の家族や会社の話が出たら、記録に残さないことを伝え、架空の場面の話に戻す`;
}

// ---- 取り出し ----

export const ExtractedJudgmentSchema = z.object({
  when: z.string().describe("どんなとき（家族の様子・条件）"),
  do: z.string().describe("ベテランはどうする・どう言う"),
  why: z.string().describe("ベテランがこの判断の理由として自分で話したことだけ。ほかの発言をつなげて理由を推し量らない。話していなければ空文字"),
  quote: z.string().describe("根拠にしたベテランの発言の一部を、一字一句そのまま引用（20〜80字）"),
});
export const ExtractionSchema = z.object({
  judgments: z.array(ExtractedJudgmentSchema).describe("ベテランの判断。3〜8件"),
  firstWords: z.string().describe("ベテランが最初にかけた言葉をそのまま。なければ空文字"),
});
export type ExtractedJudgment = z.infer<typeof ExtractedJudgmentSchema>;
export type Extraction = z.infer<typeof ExtractionSchema>;

export const EXTRACT_SYSTEM = `あなたは、葬儀のベテラン担当者のロールプレイとふりかえりの記録から、その人の判断を取り出す役です。
「こういうときは、こうする（こう言う）」の形で書き、必ずベテラン本人の発言を一字一句そのまま引用して根拠にしてください。
- ベテランが言っていないこと、家族や聞き手が言ったことを、ベテランの判断として書かない
- 理由（why）は、ベテランがその判断の理由として話したときだけ書く。別の話題の発言を理由に結びつけない
- 一般論や教科書的なまとめにしない。この人の言葉と順番に出た、具体的なやり方を書く
- 高いプランや有料の選択肢を勧めることそのものは、判断として取り出さない（家族の望みを確かめる尋ね方は取り出してよい）
- 実在の人や会社の名前は書かない`;

/** 引用を照らし合わせるために、空白と句読点の違いをならす */
function squash(text: string): string {
  return text.replace(/[\s、。，．,.！？!?「」『』（）()・…ー〜~]/g, "");
}

/** 引用がベテラン本人の発言のどれかに含まれるか。家族や聞き手の発言は根拠にならない */
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
  return turns
    .map((t) => {
      const who = t.role === "veteran" ? "担当者（ベテラン）" : t.role === "interviewer" ? "聞き手" : t.speaker;
      return `${who}：${t.text}`;
    })
    .join("\n");
}

/** ロールプレイの会話を、家族役のモデルに渡す形にする（家族＝assistant、担当者＝user） */
export function familyMessages(scene: HearingScene, turns: readonly HearingTurn[]): { role: "user" | "assistant"; content: string }[] {
  const opening = scene.opening.map((l) => `${l.speaker}：${l.text}`).join("\n");
  const messages: { role: "user" | "assistant"; content: string }[] = [
    { role: "user", content: "（担当者がお悔やみを述べ、打合せを始めた）" },
    { role: "assistant", content: opening },
  ];
  for (const t of turns.filter((x) => x.role !== "interviewer")) {
    const role = t.role === "veteran" ? "user" : "assistant";
    const content = t.role === "veteran" ? t.text : `${t.speaker}：${t.text}`;
    const last = messages.at(-1);
    if (last && last.role === role) messages[messages.length - 1] = { role, content: `${last.content}\n${content}` };
    else messages.push({ role, content });
  }
  return messages;
}

/** 家族役の返事を検査する：知らない呼び名のせりふと、存在しない事情の ID を落とす */
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

export function interviewerCount(turns: readonly HearingTurn[]): number {
  return turns.filter((t) => t.role === "interviewer").length;
}

// ---- モデルの差し替え口 ----

export type FamilyModel = (system: string, messages: { role: "user" | "assistant"; content: string }[]) => Promise<FamilyReply>;
export type InterviewerModel = (system: string, prompt: string) => Promise<InterviewerReply>;
export type ExtractModel = (system: string, prompt: string) => Promise<Extraction>;

export async function nextFamilyLines(scene: HearingScene, turns: readonly HearingTurn[], model: FamilyModel): Promise<FamilyReply> {
  if (!lastIsVeteran(turns)) throw new HearingInputError("担当者の発言のあとに家族が答えます");
  const reply = await model(familySystem(scene), familyMessages(scene, turns));
  const clean = sanitizeFamilyReply(scene, reply);
  if (clean.lines.length === 0) return { lines: [{ speaker: scene.family[0]?.label ?? "家族", text: "……はい。" }], revealed: [] };
  return clean;
}

export async function nextInterviewerQuestion(scene: HearingScene, turns: readonly HearingTurn[], model: InterviewerModel): Promise<InterviewerReply> {
  const asked = interviewerCount(turns);
  if (asked >= DEBRIEF_QUESTIONS + 1) return { question: "ありがとうございました。", done: true };
  const prompt = `## 打合せとふりかえりの記録\n${transcriptText(turns)}\n\nこれまでに尋ねた数：${asked}`;
  const reply = await model(interviewerSystem(), prompt);
  return { question: reply.question.trim(), done: reply.done || asked + 1 > DEBRIEF_QUESTIONS };
}

export async function extractJudgments(
  scene: HearingScene,
  turns: readonly HearingTurn[],
  model: ExtractModel,
): Promise<{ readonly extraction: Extraction; readonly dropped: number }> {
  if (!turns.some((t) => t.role === "veteran")) throw new HearingInputError("担当者の発言がまだありません");
  const prompt = `## 場面\n${scene.card.join("\n")}\n\n## 記録\n${transcriptText(turns)}`;
  return keepGrounded(await model(EXTRACT_SYSTEM, prompt), turns);
}
