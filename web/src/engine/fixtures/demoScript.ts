import type { Speaker } from "../case";

export interface ScriptLine {
  readonly speaker: Speaker;
  readonly speakerLabel: string;
  readonly text: string;
}

/** デモの打合せの台本（架空）。収録音声がないときは、これを順に流す */
export const DEMO_SCRIPT: readonly ScriptLine[] = [
  { speaker: "staff", speakerLabel: "担当者", text: "このたびはご愁傷さまでございます。まず、お母さまがお亡くなりになるまでのことを、お聞かせいただけますか。" },
  { speaker: "chief_mourner", speakerLabel: "喪主（長女）", text: "母は半年くらい入院していて、最後はほとんど話せませんでした。84歳でした。" },
  { speaker: "chief_mourner", speakerLabel: "喪主（長女）", text: "お風呂が好きな人だったので、入院中ずっと入りたがっていたんです。" },
  { speaker: "staff", speakerLabel: "担当者", text: "そうでしたか。ご葬儀には、どなたに来ていただきたいですか。" },
  { speaker: "chief_mourner", speakerLabel: "喪主（長女）", text: "家族と、母の妹たちくらいで、家族葬にしたいと思っています。" },
  { speaker: "family", speakerLabel: "喪主の夫", text: "孫が東京にいて、着くのは3日後になりそうです。" },
  { speaker: "chief_mourner", speakerLabel: "喪主（長女）", text: "孫には、ちゃんと顔を見てお別れさせてあげたいです。おばあちゃん子だったので。" },
  { speaker: "chief_mourner", speakerLabel: "喪主（長女）", text: "正直、費用はできるだけ抑えたいんですけど…" },
];
