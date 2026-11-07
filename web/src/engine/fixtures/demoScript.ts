import type { Speaker } from "../case";
import { DEMO_CASE } from "./demoCase";
import { demoDates } from "./demoTimeline";

export interface ScriptLine {
  readonly speaker: Speaker;
  readonly speakerLabel: string;
  readonly text: string;
}

/**
 * デモの打合せの台本（架空）。収録音声がないときは、これを順に流す。
 * 実際の打合せの順に沿う：お悔やみと挨拶 → 関係性 → 亡くなるまでの流れとお別れの様子 → 故人の好きだったこと → 来てほしい人と親戚 → お寺 → 日程 → 費用 → 手配。
 * 担当者は新人という設定で、お寺の都合や孫の到着を確かめる前に火葬場の空きを伝えてしまう（見落としが起きやすい場面）。
 * 後半は、お寺と孫の到着に合わせて日程を決め直し、祭壇・料理・香典返しの数を決める（会話から候補が出て、担当者が確定する）。
 * 日付は、亡くなった日（「最初から」を押した日）から数える
 */
export function demoScript(diedAt: string): readonly ScriptLine[] {
  const d = demoDates(diedAt);
  return [
    ...FIRST_HALF,
    { speaker: "staff", speakerLabel: "担当者", text: "失礼いたしました。お寺さんのご都合と、お孫さんのご到着を先に伺うべきでした。お寺さんには、このあと私からもご連絡いたします。" },
    { speaker: "chief_mourner", speakerLabel: "喪主（長女）", text: "さきほどお寺さんに電話したら、" + d.wake + "の夜と、次の日の午前なら来ていただけるそうです。" },
    { speaker: "staff", speakerLabel: "担当者", text: "それでは、お通夜は" + d.wake + "の18時、ご葬儀は" + d.funeral + "の10時、どちらも当社の東会館でいかがでしょうか。火葬は" + d.funeral + "の12時に市営斎場を押さえます。" },
    { speaker: "chief_mourner", speakerLabel: "喪主（長女）", text: "それでお願いします。それなら孫も間に合います。" },
    { speaker: "staff", speakerLabel: "担当者", text: "ご納棺は、お孫さんが着かれてから、" + d.wake + "の14時にいたしましょう。お母さまの愛用の品があれば、一緒にお入れできます。" },
    { speaker: "chief_mourner", speakerLabel: "喪主（長女）", text: "湯灌はしなくて大丈夫です。普通の納棺で、母の好きだった物を入れてあげたいです。" },
    { speaker: "staff", speakerLabel: "担当者", text: "祭壇は、小さめの生花祭壇でも、お花を中心にお飾りできます。お花の色のご希望はございますか。" },
    { speaker: "chief_mourner", speakerLabel: "喪主（長女）", text: "小さめので。お花は、白と淡い黄色にしてもらえますか。庭の花みたいな色で。" },
    { speaker: "staff", speakerLabel: "担当者", text: "ご参列は15名ほどですね。お料理と香典返しは、どのくらいご用意しましょうか。" },
    { speaker: "family", speakerLabel: "喪主の夫", text: "料理は15人分で。香典返しは30個あれば足りると思います。" },
    { speaker: "chief_mourner", speakerLabel: "喪主（長女）", text: "お香典はいただくことにします。お悔やみ欄は、家族葬なので今回は載せないでおきます。" },
    { speaker: "staff", speakerLabel: "担当者", text: "承知しました。火葬場へは、何名さまでいらっしゃいますか。" },
    { speaker: "family", speakerLabel: "喪主の夫", text: "10人くらいです。" },
  ];
}

/** 前半：お悔やみから、費用とお悔やみ欄の相談まで */
const FIRST_HALF: readonly ScriptLine[] = [
  { speaker: "staff", speakerLabel: "担当者", text: "このたびは、心よりお悔やみ申し上げます。この度のご葬儀のお手伝いを、精一杯させていただきます。よろしくお願いいたします。" },
  { speaker: "chief_mourner", speakerLabel: "喪主（長女）", text: "よろしくお願いします。娘です。私が喪主をします。" },
  { speaker: "staff", speakerLabel: "担当者", text: "まず初めに、お母さまがお亡くなりになるまでの流れを、お伺いしてもよろしいでしょうか。" },
  { speaker: "chief_mourner", speakerLabel: "喪主（長女）", text: "母は半年ほど入院していて……84歳でした。" },
  { speaker: "staff", speakerLabel: "担当者", text: "長い間、お疲れさまでした。最期は、ご家族でお別れやお話はできましたか。" },
  { speaker: "chief_mourner", speakerLabel: "喪主（長女）", text: "最後はほとんど話せなかったんですけど、手を握って、みんなで見送れました。" },
  { speaker: "staff", speakerLabel: "担当者", text: "そうでしたか。理想のお見送りができますように、いくつかお伺いさせてください。お母さまは、どんなことがお好きな方でしたか。" },
  { speaker: "chief_mourner", speakerLabel: "喪主（長女）", text: "明るくて、きれい好きな人でした。家のお風呂が何よりの楽しみで、入院中もずっと「お風呂に入りたい」って言っていたんです。" },
  { speaker: "family", speakerLabel: "喪主の夫", text: "庭の花の手入れも、毎朝欠かさなかったですね。" },
  { speaker: "staff", speakerLabel: "担当者", text: "ご葬儀には、どなたに来ていただきたいとお考えですか。ご親戚はどちらにいらっしゃいますか。" },
  { speaker: "chief_mourner", speakerLabel: "喪主（長女）", text: "家族と、母の妹たちくらいで。家族葬でと思っています。" },
  { speaker: "family", speakerLabel: "喪主の夫", text: "孫が東京にいて、こちらに着くのは3日後になりそうなんです。" },
  { speaker: "chief_mourner", speakerLabel: "喪主（長女）", text: "孫はおばあちゃん子だったので、ちゃんと顔を見てお別れさせてあげたいです。" },
  { speaker: "staff", speakerLabel: "担当者", text: "お寺さんは、お付き合いのあるところはございますか。" },
  { speaker: "chief_mourner", speakerLabel: "喪主（長女）", text: "うちの菩提寺は、市外にあるんです。" },
  { speaker: "staff", speakerLabel: "担当者", text: "火葬場は、いちばん早いと明後日に空きがあるようです。" },
  { speaker: "chief_mourner", speakerLabel: "喪主（長女）", text: "明後日だと、孫が間に合わないんです……。" },
  { speaker: "chief_mourner", speakerLabel: "喪主（長女）", text: "それと、正直、費用はできるだけ抑えたいんですけど…" },
  { speaker: "chief_mourner", speakerLabel: "喪主（長女）", text: "あと、新聞のお悔やみ欄にも出したほうがいいんでしょうか。" },
];

/** テスト用：日付を固定した台本 */
export const DEMO_SCRIPT: readonly ScriptLine[] = demoScript(DEMO_CASE.registration?.deceased.diedAt ?? "2026-11-07T05:30");
