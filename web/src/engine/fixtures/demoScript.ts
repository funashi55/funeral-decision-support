import type { Speaker } from "../case";

export interface ScriptLine {
  readonly speaker: Speaker;
  readonly speakerLabel: string;
  readonly text: string;
}

/**
 * デモの打合せの台本（架空）。収録音声がないときは、これを順に流す。
 * 実際の打合せの順に沿う：お悔やみとねぎらい → 亡くなるまでの経緯とお別れの様子 → 故人の人柄 → 来てほしい人 → お寺 → 日程 → 費用 → 手配。
 * 担当者は新人という設定で、お寺の都合や孫の到着を確かめる前に火葬場の空きを伝えてしまう（見落としが起きやすい場面）。
 */
export const DEMO_SCRIPT: readonly ScriptLine[] = [
  { speaker: "staff", speakerLabel: "担当者", text: "このたびは、心よりお悔やみ申し上げます。本日担当させていただきます。長い間、本当にお疲れさまでした。" },
  { speaker: "chief_mourner", speakerLabel: "喪主（長女）", text: "ありがとうございます。母は半年ほど入院していて……84歳でした。" },
  { speaker: "staff", speakerLabel: "担当者", text: "最期は、ご家族でそばにいらっしゃることはできましたか。" },
  { speaker: "chief_mourner", speakerLabel: "喪主（長女）", text: "最後はほとんど話せなかったんですけど、手を握って、みんなで見送れました。" },
  { speaker: "staff", speakerLabel: "担当者", text: "そうでしたか。よろしければ、お母さまがどんな方だったか、お聞かせいただけますか。" },
  { speaker: "chief_mourner", speakerLabel: "喪主（長女）", text: "明るくて、きれい好きな人でした。家のお風呂が何よりの楽しみで、入院中もずっと「お風呂に入りたい」って言っていたんです。" },
  { speaker: "family", speakerLabel: "喪主の夫", text: "庭の花の手入れも、毎朝欠かさなかったですね。" },
  { speaker: "staff", speakerLabel: "担当者", text: "ご葬儀には、どなたに来ていただきたいとお考えですか。" },
  { speaker: "chief_mourner", speakerLabel: "喪主（長女）", text: "家族と、母の妹たちくらいで。家族葬でと思っています。" },
  { speaker: "family", speakerLabel: "喪主の夫", text: "孫が東京にいて、こちらに着くのは3日後になりそうなんです。" },
  { speaker: "chief_mourner", speakerLabel: "喪主（長女）", text: "孫には、ちゃんと顔を見てお別れさせてあげたいです。おばあちゃん子だったので。" },
  { speaker: "staff", speakerLabel: "担当者", text: "お寺さんは、お付き合いのあるところはございますか。" },
  { speaker: "family", speakerLabel: "喪主の夫", text: "妻の実家の菩提寺なんですが、市外なんです。" },
  { speaker: "staff", speakerLabel: "担当者", text: "火葬場は、いちばん早いと明後日に空きがあるようです。" },
  { speaker: "chief_mourner", speakerLabel: "喪主（長女）", text: "明後日だと、孫が間に合わないんです……。" },
  { speaker: "chief_mourner", speakerLabel: "喪主（長女）", text: "それと、正直、費用はできるだけ抑えたいんですけど…" },
  { speaker: "chief_mourner", speakerLabel: "喪主（長女）", text: "あと、新聞のお悔やみ欄にも出したほうがいいんでしょうか。" },
];
