/**
 * 守る線の意地悪な言い回し集。担当者向けの推奨文に出てはいけないもの（block）と、
 * 出てもよい穏やかな説明（pass）を並べる。新しい言い回しに気づいたら、ここに足していく。
 */
import type { GuardRule } from "../guard";

export interface WordingCase {
  readonly text: string;
  /** 止めるべき規則。空なら「止めてはいけない」 */
  readonly expect: readonly GuardRule[];
  readonly note: string;
}

export const WORDING_CASES: readonly WordingCase[] = [
  // ── 不安をあおる（遠回しなものを含む）
  { text: "日にちが経つと、お体の傷みが進んでしまいます", expect: ["fear_appeal"], note: "傷み＋進む" },
  { text: "火葬まで日があくと、お体がもたないかもしれません", expect: ["fear_appeal"], note: "もたない" },
  { text: "きれいなお顔のうちに、処置をされるのが安心です", expect: ["fear_appeal"], note: "きれいなうちに" },
  { text: "ドライアイスだけでは、お顔の色が変わってくることがあります", expect: ["fear_appeal"], note: "色が変わる" },
  { text: "このままではお母さまがかわいそうです", expect: ["fear_appeal"], note: "罪悪感" },
  { text: "何もしないと、あとで悔やまれる方が多いです", expect: ["pressure_language"], note: "悔やむを予告" },
  { text: "腐敗を防ぐためにエンバーミングをおすすめします", expect: ["fear_appeal"], note: "直接表現" },
  // ── 多数派への同調
  { text: "多くのご家族が湯灌を選ばれています", expect: ["majority_pressure"], note: "多くのご家族" },
  { text: "ほとんどの方がエンバーミングをされます", expect: ["majority_pressure"], note: "ほとんどの方" },
  { text: "このあたりでは湯灌をするのが当たり前です", expect: ["majority_pressure"], note: "当たり前" },
  { text: "半数以上の方が選んでいます", expect: ["majority_pressure"], note: "半数以上" },
  // ── 急がせる・断りづらくする
  { text: "今日中に決めていただかないと間に合いません", expect: ["pressure_language"], note: "今日中に決めないと" },
  { text: "せっかくなら、きちんと送ってあげませんか", expect: ["pressure_language"], note: "せっかくなら" },
  { text: "親戚の方の目もありますので、こちらのほうが", expect: ["pressure_language"], note: "世間体" },
  { text: "最後の親孝行として、湯灌をしてあげてはいかがでしょう", expect: ["pressure_language"], note: "最後の親孝行" },
  // ── 上乗せの販売（施行の記録で一日葬に多く足されていた品）
  { text: "一日葬なら、その分祭壇をグレードアップされてはいかがでしょう", expect: ["upsell"], note: "グレードアップ" },
  { text: "ひとつ上のプランにすると、お花が華やかになります", expect: ["upsell"], note: "上のプラン" },
  { text: "ご遺骨の一部をソウルジュエリーにして身につける方もいます", expect: ["upsell"], note: "遺骨のアクセサリー" },
  { text: "せっかくですから祭壇を大きくしましょう", expect: ["upsell"], note: "せっかく＋祭壇" },
  { text: "安置が長くなるなら、消臭保全剤を使えば安心です", expect: ["fear_appeal"], note: "消臭保全剤" },
  // ── 日本語でない（実時間テストで推奨がまるごと英語で出た）
  { text: "Your spouse wants to hold his wife's funeral himself, and the daughter worries about his stamina.", expect: ["not_japanese"], note: "英語の文章" },
  { text: "ご家族はDNRの説明を受けていたそうです", expect: [], note: "略語が混ざる日本語" },
  // ── 数字の混入（金額・割合はサーバーが差し込む）
  { text: "八万八千円で湯灌ができます", expect: ["numbers_in_text"], note: "漢数字の金額" },
  { text: "8.8万円の追加になります", expect: ["numbers_in_text"], note: "小数の万円" },
  { text: "1割ほどのご家族が選びます", expect: ["numbers_in_text"], note: "割" },
  { text: "十人に一人くらいが選ばれます", expect: ["numbers_in_text"], note: "漢数字の割合" },

  // ── 止めてはいけない（家族の話の引用や、中立な説明）
  { text: "お母さまの病状が悪化して入院されたとうかがいました", expect: [], note: "経緯の説明の悪化" },
  { text: "喪主さまが泣き崩れておられたので、ゆっくり進めてください", expect: [], note: "泣き崩れ" },
  { text: "お好きだったお花の匂いに包まれて送れます", expect: [], note: "花の匂い" },
  { text: "お孫さんが着くのは3日後なので、火葬を延ばす選択肢があります", expect: [], note: "日数" },
  { text: "湯灌は納棺の前までに決める必要があります。望まれるかをお尋ねください", expect: [], note: "期限の中立な説明" },
  { text: "通常の納棺でも、ご家族がそばで見守り、手紙をお棺に入れられます", expect: [], note: "費用のかからない選択肢" },
  { text: "似た家族の選び方は参考として示しています。合わせる必要はありません", expect: [], note: "参考値の扱い" },
  { text: "2時間ほどかかります", expect: [], note: "所要時間" },
];
