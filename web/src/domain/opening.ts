/**
 * 打合せの入り方：決めることより先に、ご家族のお話を引き出す。
 * いきなり葬儀の形やお別れの仕方を尋ねず、まずお悔やみと、亡くなるまでのこと・最期のこと・故人のことを伺う。
 * 尋ね方は開いた問い（ご家族が話したいだけ話せる）。決めつけ（「急でしたね」）は避け、両方を差し出す。
 * 会話で触れたら ✓ を付ける（AI を使わない。毎回同じ判定になる）。
 */
import type { Utterance } from "../engine/case";

export interface OpeningStep {
  readonly id: string;
  readonly title: string;
  /** 声かけの例（例。使うかどうかは担当者が決める） */
  readonly say: string;
  /** なぜ先に伺うか */
  readonly why: string;
  /** 会話で触れたとみなす言葉（担当者・ご家族どちらの発言でも） */
  readonly cues: readonly RegExp[];
}

export const OPENING_STEPS: readonly OpeningStep[] = [
  {
    id: "condolence",
    title: "お悔やみと、ねぎらい",
    say: "このたびは、心よりお悔やみ申し上げます。お疲れのところ、ありがとうございます。",
    why: "最初のひと言で、急がされない場だと伝わります。",
    cues: [/お悔やみ/, /ご愁傷/, /お疲れ/],
  },
  {
    id: "how_it_happened",
    title: "亡くなるまでのこと",
    say: "差し支えなければ、どのようなご様子だったか伺ってもよろしいですか。急なことでしたか、それとも入院などされていましたか。",
    why: "急な別れか、看取りの時間があったかで、ご家族の心の準備も、お別れで大事にしたいことも変わります。決めつけずに両方を差し出します。",
    cues: [/急/, /突然/, /入院/, /病院/, /施設/, /経緯/, /様子/, /倒れ/, /闘病/],
  },
  {
    id: "last_moments",
    title: "最期のこと",
    say: "最期は、ご家族でお別れやお話はできましたか。",
    why: "お別れの言葉を交わせなかったご家族には、葬儀の中でその時間をつくる提案が意味を持ちます。",
    cues: [/最期/, /最後は/, /看取/, /手を握/, /間に合/, /話せ/],
  },
  {
    id: "who_they_were",
    title: "故人のこと",
    say: "どんな方でしたか。お好きだったことや、大事にされていたことはありますか。",
    why: "人柄や好きだったものが、花の色・棺に入れるもの・お別れの形の手がかりになります。",
    cues: [/どんな方/, /好き/, /趣味/, /楽しみ/, /口ぐせ/, /人柄/],
  },
];

/** 会話で触れた入り方の項目（ID の集合） */
export function openingCovered(utterances: readonly Utterance[]): ReadonlySet<string> {
  return new Set(OPENING_STEPS.filter((s) => utterances.some((u) => s.cues.some((c) => c.test(u.text)))).map((s) => s.id));
}

/** まだ入り方の途中か（お話を引き出す項目が半分も済んでいない） */
export function stillOpening(utterances: readonly Utterance[]): boolean {
  return openingCovered(utterances).size < Math.ceil(OPENING_STEPS.length / 2) + 1;
}
