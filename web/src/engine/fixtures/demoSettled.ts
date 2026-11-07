/**
 * デモの打合せ（demoScript）のあと、担当者がご家族と確かめて確定する値（架空）。
 * 台本に合わせる：孫が3日後に着く → 納棺と通夜は孫が着く11月10日／費用を抑えたい → 小さめの祭壇／庭の花が好き → 花の色。
 * 発注書・受注書をデモで開くときに、この値で埋まるようにする（実際の打合せでは担当者が一つずつ確定する）
 */
export const DEMO_SETTLED: Readonly<Record<string, string>> = {
  chief_mourner: "長女",
  attendees_scope: "家族と故人の妹たち 約15名",
  funeral_style: "家族葬",
  wake_held: "行う",
  religion: "浄土真宗（菩提寺は市外）",
  temple: "菩提寺は市外にある。ご住職の都合を先に伺う",
  relatives_arrival: "孫が11月10日の昼に着く",
  laying_in_style: "通常の納棺（愛用の品を一緒に入れる）",
  laying_in_date: "11月10日 14時",
  resting_place: "会館の安置室（3日間）",
  wake_date: "11月10日 18時 当社 東会館",
  funeral_date: "11月11日 10時 当社 東会館",
  cremation_date: "11月11日 12時 市営斎場",
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
