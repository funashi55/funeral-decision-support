import type { CaseState } from "../case";

/** デモ用の架空の家族。人物・発言はすべて架空 */
export const DEMO_CASE: CaseState = {
  caseId: "demo-yamada",
  familyName: "山田家",
  profile: { daysUntilFuneral: 6, deceasedAge: 84, funeralStyle: "家族葬" },
  // 受付で伺ったこと（架空）
  registration: {
    familyName: "山田",
    deceased: { name: "山田 ハナ", age: 84, sex: "女性", diedAt: "2026-11-07T05:30", diedPlace: "市内の病院" },
    chiefMourner: { relation: "長女", name: undefined, phone: undefined },
    membership: "わからない",
    funeralStyle: "家族葬",
    religion: undefined,
    temple: undefined,
    restingPlace: "会館",
    memo: "早朝に病院からお迎え。会館の安置室に安置",
    registeredAt: 0,
  },
  utterances: [
    { id: "U1", speaker: "chief_mourner", speakerLabel: "喪主（長女）", text: "母は半年くらい入院していて、最後はほとんど話せませんでした。", at: 30 },
    { id: "U2", speaker: "chief_mourner", speakerLabel: "喪主（長女）", text: "お風呂が好きな人だったので、入院中ずっと入りたがっていたんです。", at: 55 },
    { id: "U3", speaker: "family", speakerLabel: "喪主の夫", text: "孫が東京にいて、着くのは3日後になりそうです。", at: 80 },
    { id: "U4", speaker: "chief_mourner", speakerLabel: "喪主（長女）", text: "孫には、ちゃんと顔を見てお別れさせてあげたいです。", at: 95 },
    { id: "U5", speaker: "chief_mourner", speakerLabel: "喪主（長女）", text: "正直、費用はできるだけ抑えたいんですけど…", at: 120 },
  ],
  circumstances: [
    { id: "C1", text: "半年の入院の末に亡くなった", utteranceIds: ["U1"] },
    { id: "C2", text: "故人はお風呂が好きで、入院中ずっと入りたがっていた", utteranceIds: ["U2"] },
    { id: "C3", text: "孫が東京から3日後に到着する。孫に顔を見てお別れさせたい", utteranceIds: ["U3", "U4"] },
    { id: "C4", text: "費用はできるだけ抑えたい", utteranceIds: ["U5"] },
  ],
  decisions: {},
  requests: [],
  familyToken: "yamada-k7m2q9",
  familyLinkRevoked: false,
  feedback: [],
  familyChat: [],
  familyNotes: [],
  customTodos: [],
  audit: [],
};
