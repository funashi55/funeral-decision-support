/**
 * 実時間テスト用の架空の打合せ。人物・会話はすべて架空。
 * 施行の記録で見えた事情（高齢の喪主、菩提寺なし、互助会の積立、費用の苦しさ、急な死、近所の手前）を組み合わせた。
 * checkpoints：その行のあとで推奨（お別れの仕方）を出してみる
 */
import type { ScriptLine } from "../src/engine/fixtures/demoScript";
import { DEMO_SCRIPT } from "../src/engine/fixtures/demoScript";

export interface RealtimeFamily {
  readonly id: string;
  readonly title: string;
  readonly lines: readonly ScriptLine[];
  readonly checkpoints: readonly number[];
  /** 推奨に入っていてほしいこと（人が結果を読むときの観点） */
  readonly expect: string;
}

const staff = (text: string): ScriptLine => ({ speaker: "staff", speakerLabel: "担当者", text });
const chief = (label: string) => (text: string): ScriptLine => ({ speaker: "chief_mourner", speakerLabel: label, text });
const family = (label: string) => (text: string): ScriptLine => ({ speaker: "family", speakerLabel: label, text });

const husband = chief("喪主（夫）");
const daughter = family("長女");
const son = chief("喪主（長男）");
const wife = chief("喪主（妻）");
const sister = family("故人の妹");

export const REALTIME_FAMILIES: readonly RealtimeFamily[] = [
  { id: "F1", title: "デモの家族（入院が長く、孫が遠方、費用を抑えたい）", lines: DEMO_SCRIPT, checkpoints: [13, 18], expect: "孫の到着に合わせた日程、湯灌は勧めず尋ねる、費用のかからない選択肢" },
  {
    id: "F2",
    title: "高齢の夫が喪主、耳が遠い、日程が短い",
    lines: [
      staff("このたびはご愁傷さまでございます。奥さまのこと、少しお聞かせいただけますか。"),
      husband("……ああ、はい。家内は八十で、急に具合が悪くなって、三日で逝ってしまいました。"),
      daughter("父は耳が遠いので、私が代わりにお答えすることもあると思います。"),
      husband("わしが喪主をやります。家内の葬式は、わしが出してやりたい。"),
      daughter("父の体力が心配で、何日も続くのはきついと思うんです。"),
      daughter("火葬場は明後日なら空いていると聞きました。"),
      husband("通夜は、やらんでもいいのかね。"),
      daughter("お花が好きな母だったので、お花だけはきれいにしてあげたいです。"),
    ],
    checkpoints: [4, 7],
    expect: "喪主本人に確かめる、一日葬も並べる（費用が下がるとは限らない）、花の希望は家族の言葉から",
  },
  {
    id: "F3",
    title: "菩提寺なし・会員でない・費用が苦しい",
    lines: [
      staff("このたびはご愁傷さまでございます。お兄さまのこと、お聞かせいただけますか。"),
      chief("喪主（妹）")("兄は一人暮らしで、アパートで亡くなっているのを大家さんが見つけてくれました。"),
      chief("喪主（妹）")("警察で調べてもらって、昨日ようやく戻ってきたところです。"),
      chief("喪主（妹）")("お寺とのお付き合いはなくて、宗派もわかりません。"),
      chief("喪主（妹）")("互助会にも入っていなかったと思います。"),
      chief("喪主（妹）")("正直、私も年金暮らしで、お金はほとんど出せないんです。"),
      chief("喪主（妹）")("兄は生活保護を受けていました。"),
      chief("喪主（妹）")("できれば、顔だけは見てお別れしたいです。"),
    ],
    checkpoints: [5, 8],
    expect: "費用のかからない選択肢を先に、葬祭扶助の確認、菩提寺なしを前提にしない、不安をあおらない",
  },
  {
    id: "F4",
    title: "互助会の会員・親族の到着が遅れ日数が延びる・湯灌を家族から希望",
    lines: [
      staff("このたびはご愁傷さまでございます。お父さまのこと、お聞かせください。"),
      son("父は八十七で、施設で眠るように亡くなりました。最期は穏やかでした。"),
      son("父は互助会に入っていて、母が毎月積み立てていたはずです。"),
      son("弟がアメリカにいて、帰ってくるのに五日はかかりそうなんです。"),
      son("それまで、会館で預かってもらえるんでしょうか。"),
      family("喪主の妻")("お義父さん、お風呂が何より好きだったから、きれいにしてあげたいねって話していたんです。"),
      son("お寺は曹洞宗の、昔からの菩提寺があります。"),
      son("日にちが延びると、費用はどのくらい変わりますか。"),
    ],
    checkpoints: [6, 8],
    expect: "日数で安置料と冷却が変わることを先に伝える、積立の残りの確認、湯灌は家族の言葉を根拠に",
  },
  {
    id: "F5",
    title: "急な死・若い故人・家族が遺体の状態を心配する",
    lines: [
      staff("このたびは、突然のことで、ご愁傷さまでございます。"),
      wife("主人は六十二で、朝、出勤前に倒れて、そのまま……。"),
      wife("まだ信じられなくて、何を決めればいいのかもわからないんです。"),
      family("長男")("大学生の娘が仙台から来ます。今日の夜には着きます。"),
      wife("顔は、きれいなままで見せてあげられますか。"),
      wife("日にちがたつと、においとか、大丈夫なんでしょうか。"),
      family("長男")("できるだけ、普通に家族で送ってあげたいです。"),
    ],
    checkpoints: [5, 7],
    expect: "不安をあおらずに事実だけ伝える、急がせない、費用のかからない選択肢",
  },
  {
    id: "F6",
    title: "近所の手前を気にする・立派にしたい気持ちと予算の迷い",
    lines: [
      staff("このたびはご愁傷さまでございます。お母さまのこと、お聞かせいただけますか。"),
      son("母は九十二で、町内会の世話役をずっとやっていた人なんです。"),
      sister("近所の人がたくさん来ると思うから、みっともない葬式にはできないわよ。"),
      son("でも、私の家も子どもの学費がかかっていて……。"),
      sister("一生に一度なんだから、お花くらい立派にしてあげないと。"),
      son("母は、派手なのは嫌いな人でしたけどね。"),
      son("相場がわからないので、普通はどのくらいなのか教えてもらえますか。"),
    ],
    checkpoints: [5, 7],
    expect: "上乗せを勧めない、多数派に合わせるよう促さない、故人の人柄（派手が嫌い）と予算の両方を拾う",
  },
];
