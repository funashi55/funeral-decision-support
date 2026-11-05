/**
 * 判断の場面（F3）。家族・発言はすべて架空。
 * 各場面で、ベテランなら選択肢をどう見るか（合う／尋ねる／今回は合わない）を答えとして持つ。
 *
 * answeredBy が "provisional" の答えは、作者（元フューネラルプランナー）の仮の答え。
 * ベテランには /veteran のページで同じ場面に答えてもらい（仮の答えは見せない）、
 * その答えで知見の前後比較（npm run compare:knowledge）をやり直す。
 */
import type { FarewellOptionId } from "../domain/farewell";

export type Fit = "suits" | "consider" | "not_now";

export const FITS: readonly Fit[] = ["suits", "consider", "not_now"];

export const FIT_LABEL: Record<Fit, string> = { suits: "合う", consider: "尋ねてみる", not_now: "今回は合わない" };

export interface SceneLine {
  readonly who: "staff" | "chief_mourner" | "family";
  readonly label: string;
  readonly text: string;
}

export interface JudgmentScene {
  readonly id: string;
  readonly title: string;
  readonly deceasedAge: number;
  readonly daysUntilFuneral?: number;
  readonly lines: readonly SceneLine[];
  readonly answer: Partial<Record<FarewellOptionId, Fit>>;
  readonly answeredBy: "provisional" | "veteran";
}

const 喪主 = (text: string): SceneLine => ({ who: "chief_mourner", label: "喪主", text });
const 家族 = (label: string, text: string): SceneLine => ({ who: "family", label, text });

export const SCENES: readonly JudgmentScene[] = [
  {
    id: "J01",
    title: "孫の到着を待ちたい",
    deceasedAge: 88,
    daysUntilFuneral: 5,
    lines: [喪主("孫が海外にいて、帰ってくるのに4日かかるんです。"), 喪主("顔を見せてあげたいんですけど、それまで大丈夫なんでしょうか。")],
    answer: { standard_laying: "suits", extend_resting: "suits", embalming: "consider", yukan: "consider" },
    answeredBy: "provisional",
  },
  {
    id: "J02",
    title: "早く済ませたい",
    deceasedAge: 79,
    lines: [喪主("父の体がどうなるのか心配で、火葬は早く済ませたいんです。"), 家族("喪主の妹", "親戚はみんな近くに住んでいます。")],
    answer: { standard_laying: "suits", extend_resting: "consider", embalming: "not_now", yukan: "consider" },
    answeredBy: "provisional",
  },
  {
    id: "J03",
    title: "長い闘病で入浴できなかった",
    deceasedAge: 72,
    lines: [喪主("一年近く寝たきりで、ずっと体を拭くだけでした。"), 喪主("きれいにしてあげたいねって、姉と話していました。")],
    answer: { standard_laying: "consider", yukan: "suits", embalming: "not_now", extend_resting: "not_now" },
    answeredBy: "provisional",
  },
  {
    id: "J04",
    title: "費用を最優先にしたい",
    deceasedAge: 91,
    lines: [喪主("年金暮らしなので、とにかく費用は最低限でお願いしたいです。"), 喪主("家族だけで送れれば十分です。")],
    answer: { standard_laying: "suits", yukan: "not_now", embalming: "not_now", extend_resting: "not_now" },
    answeredBy: "provisional",
  },
  {
    id: "J05",
    title: "事故で亡くなった",
    deceasedAge: 45,
    lines: [喪主("事故だったので、子どもたちに顔を見せていいのか迷っています。"), 喪主("できれば最後に、普段の顔で会わせてあげたい。")],
    answer: { standard_laying: "consider", embalming: "consider", yukan: "consider", extend_resting: "not_now" },
    answeredBy: "provisional",
  },
  {
    id: "J06",
    title: "自宅に連れて帰りたい",
    deceasedAge: 83,
    daysUntilFuneral: 4,
    lines: [喪主("母は家が大好きだったので、一度家に連れて帰ってあげたいです。"), 家族("喪主の夫", "近所の人にも顔を見てもらえたら。")],
    answer: { standard_laying: "suits", extend_resting: "consider", yukan: "consider", embalming: "not_now" },
    answeredBy: "provisional",
  },
  {
    id: "J07",
    title: "故人が湯灌を望んでいなかった",
    deceasedAge: 86,
    lines: [喪主("父は人に体を触られるのを嫌がる人でした。"), 喪主("簡単に、静かに送ってあげたいです。")],
    answer: { standard_laying: "suits", yukan: "not_now", embalming: "not_now", extend_resting: "not_now" },
    answeredBy: "provisional",
  },
  {
    id: "J08",
    title: "火葬場が混んで日があく",
    deceasedAge: 80,
    daysUntilFuneral: 7,
    lines: [家族("長男", "火葬場の空きが一週間先だと言われました。"), 喪主("その間、ずっと会館に預けることになるんですか。")],
    answer: { standard_laying: "suits", extend_resting: "suits", embalming: "consider", yukan: "consider" },
    answeredBy: "provisional",
  },
  {
    id: "J09",
    title: "親族の意見が分かれている",
    deceasedAge: 77,
    lines: [家族("叔父", "ちゃんとした形で送らないと恥ずかしいぞ。"), 喪主("でも母は、質素にって言っていたんです。")],
    answer: { standard_laying: "suits", yukan: "consider", embalming: "not_now", extend_resting: "not_now" },
    answeredBy: "provisional",
  },
  {
    id: "J10",
    title: "お風呂好きで、日にちも余裕がある",
    deceasedAge: 84,
    daysUntilFuneral: 6,
    lines: [喪主("母はお風呂が何より好きでした。"), 喪主("最後にさっぱりさせてあげられたら、と思います。")],
    answer: { standard_laying: "consider", yukan: "suits", extend_resting: "consider", embalming: "not_now" },
    answeredBy: "provisional",
  },
];
