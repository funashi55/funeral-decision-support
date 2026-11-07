/**
 * デモの打合せ（demoScript）の後半で、担当者がご家族と確かめて確定する値（架空）。
 * 台本に合わせる：孫が3日後に着く → 納棺と通夜は3日後／費用を抑えたい → 小さめの祭壇／庭の花が好き → 花の色。
 * テストと、録画で会話から拾い切れなかった値を補うときに使う（実際の打合せでは担当者が一つずつ確定する）
 */
import { DEMO_CASE } from "./demoCase";
import { demoDates } from "./demoTimeline";

export function demoSettled(diedAt: string): Readonly<Record<string, string>> {
  const d = demoDates(diedAt);
  return {
    chief_mourner: "長女",
    attendees_scope: "家族と故人の妹たち 約15名",
    funeral_style: "家族葬",
    wake_held: "行う",
    religion: "浄土真宗（菩提寺は市外）",
    temple: "菩提寺は市外にある。ご住職の都合を先に伺う",
    relatives_arrival: `孫が${d.wake}の昼に着く`,
    laying_in_style: "通常の納棺（愛用の品を一緒に入れる）",
    laying_in_date: `${d.wake} 14時`,
    resting_place: "会館の安置室（3日間）",
    wake_date: `${d.wake} 18時 当社 東会館`,
    funeral_date: `${d.funeral} 10時 当社 東会館`,
    cremation_date: `${d.funeral} 12時 市営斎場`,
    altar_plan: "生花祭壇（小）",
    flower_color: "白と淡い黄色（庭の花に近い色）",
    deceased_character: "お風呂が好き、毎朝の庭の花の手入れ",
    meals: "15名",
    return_gifts: "30個",
    koden_decline: "いただく",
    obituary: "載せない（家族葬のため、葬儀のあとにお知らせする）",
    thank_you_card: "30枚・標準の文面",
    crematorium_party: "10名",
    emcee: "なし（担当者が進行）",
    parking: "なし（家族葬で台数が少ない）",
    embalming: "行わない",
    budget_scope: "費用はできるだけ抑えたい",
  };
}

/** テスト用：日付を固定したデモの家族の値 */
export const DEMO_SETTLED = demoSettled(DEMO_CASE.registration?.deceased.diedAt ?? "2026-11-07T05:30");
