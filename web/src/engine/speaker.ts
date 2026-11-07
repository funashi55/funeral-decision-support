/**
 * 話した人の聞き分け（担当者か、ご遺族か）。ボタンで切り替えなくても、言葉づかいと前後の流れから決める。
 *
 * 1. まず決まりごとで見る（担当者の接客の言い回し・ご遺族の身内の呼び方）。はっきりしていればそれで決める（待ち時間なし）
 * 2. はっきりしないときだけ、直前の会話と一緒に Claude（Haiku）に尋ねる
 * 3. それも使えないときは、直前と違う人（打合せは交互に話すことが多い）にする
 * 間違えたら、発言の話した人をクリックして入れ替えられる
 */
import { z } from "zod";
import type { Speaker, Utterance } from "./case";

/** 担当者らしい言い回し（接客の敬語、故人やご家族への尊敬語、段取りの案内） */
const STAFF_CUES: readonly RegExp[] = [
  /させていただ/, /ございます/, /ございません/, /いかがでしょう/, /よろしいでしょうか/, /いかがなさい/, /なさいますか/,
  /お聞かせ/, /伺(?:っても|います|えれば)/, /ご希望/, /ご葬儀/, /ご親戚/, /ご家族(?:さま|様)?(?:は|で|の)/, /ご用意/, /ご案内/,
  /承知/, /かしこまりました/, /お悔やみ申し上げ/, /お疲れさまでした/, /お(?:母|父|祖母|祖父)(?:さま|様)/, /ご主人/, /奥(?:さま|様)/,
  /ましょうか/, /(?:確かめ|確認し|手配し|お持ちし)ます/, /ご安心/, /お待ちしております/, /お手伝い/,
  /いたし(?:ます|ましょう|ました)/, /何名さま/, /お(?:入れ|飾り|送り)でき/, /ご(?:納棺|参列|到着|連絡|都合)/, /失礼いたしました/,
];

/** ご遺族らしい言い回し（身内の呼び方、自分たちのこと、迷い・願い） */
const FAMILY_CUES: readonly RegExp[] = [
  /(?:^|[、。\s])(?:母|父|祖母|祖父|夫|妻|主人|息子|娘|孫|兄|姉|弟|妹)(?:は|が|の|に|も|と)/, /うちの/, /私(?:が|は|たち)/, /娘です/, /息子です/,
  /(?:し|させ|あげ)たい(?:です|んです)?/, /んです/, /んですけど/, /どうしたら/, /わからなくて/, /(?:好き|大好き)(?:だった|でした)/,
  /(?:で|を)?お願いします/, /大丈夫です/, /と思います/, /(?:こと|ことに)します/, /してもらえますか/, /くらいです/,
];

/** 決まりごとだけで決めてよい差 */
const CLEAR_MARGIN = 2;

export interface SpeakerGuess {
  readonly speaker: "staff" | "family";
  /** rule：決まりごとで決めた／model：Claude に尋ねた／turn：交互に話す前提で決めた */
  readonly by: "rule" | "model" | "turn";
}

const count = (text: string, cues: readonly RegExp[]): number => cues.reduce((n, c) => n + (c.test(text) ? 1 : 0), 0);

/** 決まりごとで見る。はっきりしなければ null */
export function guessByRules(text: string): SpeakerGuess | null {
  const diff = count(text, STAFF_CUES) - count(text, FAMILY_CUES);
  if (diff >= CLEAR_MARGIN) return { speaker: "staff", by: "rule" };
  if (diff <= -CLEAR_MARGIN) return { speaker: "family", by: "rule" };
  return null;
}

/** 直前と違う人にする（最初はご遺族の言葉を書き留めることが多いので、ご遺族） */
export function guessByTurn(previous: readonly Utterance[]): SpeakerGuess {
  const last = previous.at(-1);
  return { speaker: last && last.speaker !== "staff" ? "staff" : "family", by: "turn" };
}

export const SpeakerAnswerSchema = z.object({
  speaker: z.enum(["staff", "family"]).describe("staff：葬儀社の担当者／family：ご遺族（喪主・ご家族）"),
});

export type ClassifySpeaker = (system: string, prompt: string) => Promise<z.infer<typeof SpeakerAnswerSchema>>;

export const SPEAKER_SYSTEM = `葬儀の打合せの文字起こしで、新しい発言を話したのが葬儀社の担当者か、ご遺族かを見分けます。
担当者は、接客の敬語で尋ねたり、段取りを案内したりします。ご遺族は、身内のことを「母」「うちの」などと話し、迷いや願いを話します。
直前の会話の流れ（問いかけのあとは答えが来やすい）も手がかりにしてください。`;

const RECENT = 6;

export function speakerPrompt(text: string, previous: readonly Utterance[]): string {
  const recent = previous.slice(-RECENT).map((u) => `${u.speaker === "staff" ? "担当者" : "ご遺族"}：${u.text}`);
  return `## 直前の会話\n${recent.length ? recent.join("\n") : "（まだありません）"}\n\n## 新しい発言\n${text}`;
}

/** 話した人を決める。Claude が使えないとき・失敗したときは、交互に話す前提で決める */
export async function detectSpeaker(text: string, previous: readonly Utterance[], classify: ClassifySpeaker | null): Promise<SpeakerGuess> {
  const byRule = guessByRules(text);
  if (byRule) return byRule;
  if (classify) {
    try {
      const answer = await classify(SPEAKER_SYSTEM, speakerPrompt(text, previous));
      return { speaker: answer.speaker, by: "model" };
    } catch {
      // 尋ねられなければ、交互に話す前提にする
    }
  }
  return guessByTurn(previous);
}

/** 画面に出す話した人の名前 */
export function speakerLabelOf(speaker: Speaker): string {
  return speaker === "staff" ? "担当者" : "ご遺族";
}
