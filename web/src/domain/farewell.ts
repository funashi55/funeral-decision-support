/**
 * お別れの仕方の選択肢。できること・できないこと・取り消せるかは事実として固定で持ち、
 * モデルには選び方と理由だけを考えさせる。金額は pricing.ts の品目から取る。
 */

export type FarewellOptionId = "standard_laying" | "yukan" | "embalming" | "extend_resting";

export interface FarewellOption {
  readonly id: FarewellOptionId;
  readonly label: string;
  readonly summary: string;
  readonly canDo: readonly string[];
  readonly cannotDo: readonly string[];
  /** 決めたあとで取り消せるか */
  readonly reversible: boolean;
  /** いつまでに決める必要があるか */
  readonly deadline: string;
  /** 価格表の品目（null はプランに含まれる） */
  readonly catalogItemId: string | null;
}

export const FAREWELL_OPTIONS: readonly FarewellOption[] = [
  {
    id: "standard_laying",
    label: "通常の納棺",
    summary: "身支度を整え、お棺にお納めします。どのプランにも含まれています。",
    canDo: ["ご家族がそばで見守れる", "愛用の品や手紙をお棺に入れられる"],
    cannotDo: ["お体を洗い清めることはしない"],
    reversible: false,
    deadline: "納棺の日時までに",
    catalogItemId: null,
  },
  {
    id: "yukan",
    label: "湯灌",
    summary: "納棺の前に、お体を洗い清めて身支度を整えます。",
    canDo: ["ご家族が手を添えて、お体を清めることに加われる", "お風呂に入ったあとのような、さっぱりした姿で送り出せる"],
    cannotDo: ["納棺のあとからは行えない", "通常の納棺より時間がかかる（目安は2時間ほど）"],
    reversible: false,
    deadline: "納棺の前までに",
    catalogItemId: "yukan",
  },
  {
    id: "embalming",
    label: "エンバーミング",
    summary: "専門の処置で、火葬までの日数があいても穏やかなお顔を保ちやすくします。",
    canDo: ["火葬まで日数があいても、お顔を見てもらいやすい", "お顔やお体に触れてお別れしやすい"],
    cannotDo: ["処置のあいだ、ご遺体をしばらくお預かりする", "処置のあとから元に戻すことはできない"],
    reversible: false,
    deadline: "火葬の日時が決まった時点で",
    catalogItemId: "embalming",
  },
  {
    id: "extend_resting",
    label: "火葬までの日を延ばして、ゆっくりお別れする",
    summary: "安置の日数を延ばし、会いたい方が揃うまで待ちます。",
    canDo: ["遠方のご家族が着いてから、お顔を見てお別れできる", "急がずに、家族で過ごす時間をとれる"],
    cannotDo: ["安置料とドライアイスが日数分かかる", "斎場とお寺の都合に合わせる必要がある"],
    reversible: true,
    deadline: "火葬の日時を決める前に",
    catalogItemId: "resting_fee",
  },
];

export function getFarewellOption(id: string): FarewellOption {
  const option = FAREWELL_OPTIONS.find((o) => o.id === id);
  if (!option) throw new Error(`未定義のお別れの仕方です: ${id}`);
  return option;
}
