/**
 * 打合せで決める項目と、そのつながり（依存関係）。
 *
 * 実在の葬儀社のチェックリスト（打合せ41項目）の構成を参考に、
 * 架空の葬儀社向けに作り直したもの。社名・取引先・価格は含まない。
 */

export type Phase =
  | "trust" // 信頼関係（お悔やみ、亡くなるまでの経緯）
  | "hearing" // 葬儀のヒアリング（故人らしさ、来てほしい人）
  | "farewell" // お別れの仕方（納棺、湯灌、安置）
  | "schedule" // 日程（寺、火葬場、通夜・葬儀）
  | "plan" // プランと費用
  | "logistics" // 手配と書類
  | "after"; // 葬儀後

export const PHASE_LABEL: Record<Phase, string> = {
  trust: "信頼関係",
  hearing: "ヒアリング",
  farewell: "お別れの仕方",
  schedule: "日程",
  plan: "プランと費用",
  logistics: "手配と書類",
  after: "葬儀後",
};

export type Urgency = "today" | "later";

export interface DecisionItem {
  readonly id: string;
  readonly label: string;
  readonly phase: Phase;
  /** 打合せ当日に決める必要があるか */
  readonly urgency: Urgency;
  /** 後から取り消し・変更できるか（返品・変更が利くか） */
  readonly reversible: boolean;
  /** 遺族が迷いやすい、後悔しやすい決定か */
  readonly hard: boolean;
  /** この項目を決める前に決まっている必要がある項目 */
  readonly dependsOn: readonly string[];
  /** 基幹システムの施行情報の対応項目（CSV 書き出し用） */
  readonly coreField?: string;
  /** 取り消せない、または取り返しのつかない見落としにつながる項目の注意書き */
  readonly caution?: string;
}

export const DECISIONS: readonly DecisionItem[] = [
  // 信頼関係
  { id: "chief_mourner", label: "喪主を誰にするか", phase: "trust", urgency: "today", reversible: false, hard: false, dependsOn: [], coreField: "喪主名" },
  { id: "body_condition", label: "ご遺体の状態の確認", phase: "trust", urgency: "today", reversible: false, hard: false, dependsOn: [] },
  { id: "membership", label: "会員かどうか（積立の確認）", phase: "trust", urgency: "today", reversible: false, hard: false, dependsOn: [], coreField: "会員区分" },

  // ヒアリング
  { id: "attendees_scope", label: "参列の範囲と人数の目安", phase: "hearing", urgency: "today", reversible: true, hard: true, dependsOn: [] },
  { id: "funeral_style", label: "葬儀の形（家族葬・一日葬・一般葬・火葬式）", phase: "hearing", urgency: "today", reversible: false, hard: true, dependsOn: ["attendees_scope"], coreField: "葬儀区分" },
  { id: "wake_held", label: "通夜を行うか", phase: "hearing", urgency: "today", reversible: false, hard: true, dependsOn: ["funeral_style"] },
  { id: "religion", label: "宗旨・宗派", phase: "hearing", urgency: "today", reversible: false, hard: false, dependsOn: [], coreField: "宗旨・宗派" },
  { id: "temple", label: "菩提寺の有無と連絡", phase: "hearing", urgency: "today", reversible: false, hard: false, dependsOn: ["religion"], coreField: "寺院名" },
  { id: "deceased_character", label: "故人らしさ（好きな花・色・趣味）", phase: "hearing", urgency: "later", reversible: true, hard: false, dependsOn: [] },
  { id: "coffin_items", label: "棺に入れてあげたいもの", phase: "hearing", urgency: "later", reversible: true, hard: false, dependsOn: [] },

  // お別れの仕方
  { id: "laying_in_style", label: "納棺の形（通常の納棺・湯灌）", phase: "farewell", urgency: "today", reversible: false, hard: true, dependsOn: ["body_condition"], caution: "湯灌を行うかは納棺の前までに決める必要があります" },
  { id: "embalming", label: "エンバーミングを行うか", phase: "farewell", urgency: "today", reversible: false, hard: true, dependsOn: ["body_condition", "cremation_date"] },
  { id: "laying_in_date", label: "納棺の日時", phase: "farewell", urgency: "today", reversible: true, hard: false, dependsOn: ["laying_in_style", "cremation_date"] },
  { id: "resting_place", label: "安置場所（自宅・会館）と安置の日数", phase: "farewell", urgency: "today", reversible: true, hard: true, dependsOn: ["cremation_date"], coreField: "安置先名" },
  { id: "face_viewing", label: "お顔を見ていただく方の範囲", phase: "farewell", urgency: "later", reversible: true, hard: false, dependsOn: ["attendees_scope"] },

  // 日程
  { id: "cremation_order", label: "前火葬（骨葬）か後火葬か", phase: "schedule", urgency: "today", reversible: false, hard: true, dependsOn: [] },
  { id: "relatives_arrival", label: "遠方の親族の到着の見込み", phase: "schedule", urgency: "today", reversible: true, hard: false, dependsOn: [] },
  { id: "cremation_date", label: "火葬の日時と斎場", phase: "schedule", urgency: "today", reversible: false, hard: true, dependsOn: ["temple", "relatives_arrival"], coreField: "火葬日時・利用斎場", caution: "火葬は死亡後24時間以降。斎場の空きを確認してから確定します" },
  { id: "wake_date", label: "通夜の日時", phase: "schedule", urgency: "today", reversible: false, hard: false, dependsOn: ["wake_held", "cremation_date", "temple"], coreField: "通夜日" },
  { id: "funeral_date", label: "葬儀の日時と会場", phase: "schedule", urgency: "today", reversible: false, hard: false, dependsOn: ["cremation_date", "temple"], coreField: "葬儀日・葬儀会場名" },
  { id: "priest_count", label: "僧侶の人数", phase: "schedule", urgency: "later", reversible: true, hard: false, dependsOn: ["temple"] },

  // プランと費用
  { id: "altar_plan", label: "祭壇のプラン", phase: "plan", urgency: "today", reversible: true, hard: true, dependsOn: ["funeral_style", "attendees_scope"] },
  { id: "flower_color", label: "生花の色合い", phase: "plan", urgency: "later", reversible: true, hard: false, dependsOn: ["altar_plan", "deceased_character"] },
  { id: "coffin", label: "棺", phase: "plan", urgency: "today", reversible: true, hard: false, dependsOn: ["laying_in_style"] },
  { id: "meals", label: "会食の有無と人数", phase: "plan", urgency: "later", reversible: true, hard: false, dependsOn: ["attendees_scope", "wake_held"] },
  { id: "return_gifts", label: "香典返しの数", phase: "plan", urgency: "later", reversible: true, hard: false, dependsOn: ["attendees_scope"], caution: "多めに用意して、余った分は返品できます" },
  { id: "budget_scope", label: "予算の範囲（お墓など他の出費と同じ財布か）", phase: "plan", urgency: "today", reversible: true, hard: true, dependsOn: [] },
  { id: "estimate", label: "見積もりの確認と請求先", phase: "plan", urgency: "today", reversible: true, hard: false, dependsOn: ["altar_plan", "coffin", "laying_in_style"] },

  // 手配と書類
  { id: "obituary", label: "新聞のお悔やみ欄への掲載", phase: "logistics", urgency: "today", reversible: false, hard: true, dependsOn: ["funeral_date"], caution: "掲載すると取り消せません。亡くなったことをまだ伝えていないご家族がいないか、先に確かめてください" },
  { id: "photo", label: "遺影の写真と背景", phase: "logistics", urgency: "later", reversible: true, hard: false, dependsOn: [] },
  { id: "thank_you_card", label: "会葬礼状（文面・ラストレター）", phase: "logistics", urgency: "later", reversible: true, hard: false, dependsOn: ["attendees_scope"] },
  { id: "reception_desk", label: "受付と弔問の時間", phase: "logistics", urgency: "later", reversible: true, hard: false, dependsOn: ["wake_date", "funeral_date"] },
  { id: "emcee", label: "司会の有無", phase: "logistics", urgency: "later", reversible: true, hard: false, dependsOn: ["funeral_style"] },
  { id: "parking", label: "駐車場係の有無", phase: "logistics", urgency: "later", reversible: true, hard: false, dependsOn: ["attendees_scope"] },
  { id: "family_seats", label: "遺族席の数", phase: "logistics", urgency: "later", reversible: true, hard: false, dependsOn: ["attendees_scope"] },
  { id: "pacemaker", label: "ペースメーカーの有無", phase: "logistics", urgency: "today", reversible: false, hard: false, dependsOn: [], caution: "火葬の前に必ず確認が必要です" },
  { id: "death_certificate", label: "死亡届の記入", phase: "logistics", urgency: "today", reversible: false, hard: false, dependsOn: ["chief_mourner"] },
  { id: "crematorium_party", label: "火葬場へ行く人数", phase: "logistics", urgency: "later", reversible: true, hard: false, dependsOn: ["attendees_scope"] },
  { id: "koden_decline", label: "香典をいただくか、辞退するか", phase: "logistics", urgency: "today", reversible: false, hard: false, dependsOn: ["funeral_style"] },
  { id: "neighborhood_notice", label: "隣組・町内会への連絡", phase: "logistics", urgency: "today", reversible: false, hard: false, dependsOn: [] },
  { id: "flower_names", label: "供花の札名（名義）", phase: "logistics", urgency: "later", reversible: true, hard: false, dependsOn: [] },
  { id: "mourner_speech", label: "喪主のあいさつ", phase: "logistics", urgency: "later", reversible: true, hard: false, dependsOn: ["chief_mourner"] },
  { id: "transport", label: "火葬場への移動（霊柩車・マイクロバス）", phase: "logistics", urgency: "later", reversible: true, hard: false, dependsOn: ["crematorium_party"] },
  { id: "departure_stop", label: "出棺のときに寄っていく場所", phase: "logistics", urgency: "later", reversible: true, hard: false, dependsOn: ["cremation_date"] },

  // 葬儀後
  { id: "burial_place", label: "埋骨の場所と分骨", phase: "after", urgency: "later", reversible: true, hard: false, dependsOn: ["religion"] },
  { id: "memorial_tablet", label: "位牌の大きさ", phase: "after", urgency: "later", reversible: true, hard: false, dependsOn: ["religion"] },
  { id: "payment", label: "支払い方法", phase: "after", urgency: "later", reversible: true, hard: false, dependsOn: ["estimate"] },
];

const BY_ID: ReadonlyMap<string, DecisionItem> = new Map(DECISIONS.map((d) => [d.id, d]));

export function getDecision(id: string): DecisionItem {
  const item = BY_ID.get(id);
  if (!item) throw new Error(`未定義の決定項目です: ${id}`);
  return item;
}

/** id が決まると影響を受ける項目（直接・間接）を、決める順に返す */
export function impactedBy(id: string): DecisionItem[] {
  getDecision(id);
  const dependents = new Map<string, string[]>();
  for (const d of DECISIONS) {
    for (const dep of d.dependsOn) {
      dependents.set(dep, [...(dependents.get(dep) ?? []), d.id]);
    }
  }
  const seen = new Set<string>();
  const queue = [...(dependents.get(id) ?? [])];
  while (queue.length > 0) {
    const next = queue.shift() as string;
    if (seen.has(next)) continue;
    seen.add(next);
    queue.push(...(dependents.get(next) ?? []));
  }
  return decisionOrder().filter((d) => seen.has(d.id));
}

/** 依存関係に従った決める順番（トポロジカル順）。循環があれば例外 */
export function decisionOrder(): DecisionItem[] {
  const state = new Map<string, "visiting" | "done">();
  const ordered: DecisionItem[] = [];
  const visit = (id: string, path: readonly string[]): void => {
    const s = state.get(id);
    if (s === "done") return;
    if (s === "visiting") throw new Error(`決定項目の依存関係が循環しています: ${[...path, id].join(" → ")}`);
    state.set(id, "visiting");
    for (const dep of getDecision(id).dependsOn) visit(dep, [...path, id]);
    state.set(id, "done");
    ordered.push(getDecision(id));
  };
  for (const d of DECISIONS) visit(d.id, []);
  return ordered;
}

/** まだ決まっていない前提項目（これが決まらないと id は決められない） */
export function blockersOf(id: string, decided: ReadonlySet<string>): DecisionItem[] {
  return getDecision(id).dependsOn.filter((dep) => !decided.has(dep)).map(getDecision);
}
