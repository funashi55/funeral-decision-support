/**
 * 打合せの後の実務：Claude が会話と決定を読み、打合せのまとめ・担当者の TODO・業者ごとの発注書の下書きを作る。
 *
 * 守ること：
 *  - 書いてよいのは、会話にあることと決定の値だけ。数がわからないものは「要確認」にして、推測で埋めない
 *  - 金額は書かない（価格は価格表の仕事。発注書は数と納品の段取りだけ）
 *  - 確定していない決定にもとづく発注は「下書き（確定待ち）」として、送れる状態にしない。確定は人が行う
 *  - 発注の種類は orders.ts の18項目に限る（モデルが新しい発注を作らない）
 */
import { z } from "zod";
import { DECISIONS, getDecision } from "../domain/decisions";
import type { CaseState } from "./case";
import { checkText, type GuardViolation } from "./guard";
import { ORDERS, buildChecklist, buildOrders, type OrderStatus } from "./orders";

/** 発注書を送る先の業者の種類（どの発注をどの業者に1枚の発注書にまとめるか） */
export const VENDOR_OF: Readonly<Record<string, string>> = {
  pillow_set: "生花店・果物店・菓子店（枕飾り）",
  flowers: "生花店",
  farewell_flowers: "生花店",
  sweets: "菓子店",
  fruit: "果物店",
  return_gifts: "返礼品店",
  takeaway_set: "返礼品店（通夜の持ち帰りセット）",
  thank_you_card: "印刷所（会葬礼状）",
  last_letter: "ラストレター制作",
  meals: "仕出し・弁当店",
  emcee: "司会",
  parking: "警備会社（交通誘導員）",
  obituary: "新聞社（お悔やみ欄）",
  taxi: "タクシー会社",
  yukan: "納棺・湯灌の業者",
  embalming: "エンバーミングの業者",
  crematorium: "火葬場",
  temple_contact: "寺院",
  death_certificate: "市役所",
  crematorium_staff: "火葬係",
  venue_shop: "斎場の売店",
  offering_dismantle: "供物解体",
};

/**
 * 発注書（FAX）にしない手配。電話や予約、社内の段取りで済むため、発注書ではなく担当者の TODO に回す
 * （本番で「寺院 御中」「火葬場 御中」の発注書ができてしまったため）
 */
export const ARRANGE_BY_PHONE: ReadonlySet<string> = new Set(ORDERS.filter((o) => o.stage === "arrange").map((o) => o.id));

/** TODO の段取り（施行管理テンプレートの区分に合わせる） */
export const TODO_STAGES = ["打合せ前", "打合せ", "手配", "作成・用意", "施行後"] as const;
export type TodoStage = (typeof TODO_STAGES)[number];

/**
 * 施行管理テンプレートの「作成・用意物」と「施行後」。会話に出なくても毎回あるので、AI に頼らず必ず載せる
 */
const TEMPLATE_TODOS: readonly { readonly task: string; readonly stage: TodoStage; readonly when: string }[] = [
  { task: "年回表（中陰月日表）を作ってお渡しする", stage: "作成・用意", when: "亡くなった日が確定したら" },
  { task: "死亡届のコピーを取る", stage: "作成・用意", when: "市役所に出す前に" },
  { task: "お布施の封筒と香典帳をお渡しする", stage: "作成・用意", when: "通夜の前までに" },
  { task: "遺影写真を作る", stage: "作成・用意", when: "通夜の前までに" },
  { task: "看板を作る", stage: "作成・用意", when: "通夜の前までに" },
  { task: "香典返しの余りを返品する", stage: "施行後", when: "葬儀のあと" },
  { task: "集金する（請求書の説明をしてから）", stage: "施行後", when: "葬儀のあと" },
];

const orderIds = ORDERS.map((o) => o.id) as [string, ...string[]];
const decisionIds = DECISIONS.map((d) => d.id) as [string, ...string[]];

export const PaperworkDraftSchema = z.object({
  summary: z.string().describe("打合せのまとめ。家族の事情・望み・決まったこと・まだのことを3〜6文で。担当者が読み返す用"),
  todos: z
    .array(
      z.object({
        task: z.string().describe("担当者がすること。動詞で終える（例：寺院に日程を確認する）"),
        stage: z.enum(TODO_STAGES).describe("段取りのどこでするか"),
        when: z.string().describe("いつまでに。会話や決定に根拠がなければ「早めに」"),
        decisionIds: z.array(z.enum(decisionIds)),
        utteranceIds: z.array(z.string()).describe("根拠になった発言の id"),
      }),
    )
    .max(15),
  orders: z
    .array(
      z.object({
        orderId: z.enum(orderIds),
        items: z
          .array(
            z.object({
              name: z.string().describe("品名や内容"),
              quantity: z.string().describe("数。会話や決定にないときは「要確認」"),
              note: z.string().describe("色・好み・注意など。なければ空"),
            }),
          )
          .min(1)
          .max(10),
        deliverAt: z.string().describe("納品・実施の日時。わからなければ「要確認」"),
        deliverTo: z.string().describe("納品・実施の場所。わからなければ「要確認」"),
        notes: z.string().describe("業者への申し送り。家族の希望を短く。なければ空"),
        utteranceIds: z.array(z.string()),
      }),
    )
    .max(18),
  askFamily: z.array(z.string()).max(6).describe("発注の前に家族に確かめること（数・日時・好みなど）"),
});

export type PaperworkDraft = z.infer<typeof PaperworkDraftSchema>;

export interface OrderSheet {
  readonly orderId: string;
  readonly label: string;
  readonly vendor: string;
  /** ready：確定した決定だけで書けている（送れる）／waiting：確定待ちの決定がある（下書き） */
  readonly status: OrderStatus;
  readonly waitingFor: readonly string[];
  readonly items: PaperworkDraft["orders"][number]["items"];
  readonly deliverAt: string;
  readonly deliverTo: string;
  readonly notes: string;
  readonly utteranceIds: readonly string[];
  /** 「要確認」のまま残っている欄の数。0 でなければ、担当者が埋めてから送る */
  readonly blanks: number;
}

/** 発注書をそのまま送れるか：決定が確定していて、要確認の欄が残っていない */
export function isSendable(sheet: OrderSheet): boolean {
  return sheet.status === "ready" && sheet.blanks === 0;
}

const BLANK = /要確認/;

function countBlanks(o: PaperworkDraft["orders"][number]): number {
  return [o.deliverAt, o.deliverTo, ...o.items.map((i) => i.quantity)].filter((v) => !v.trim() || BLANK.test(v)).length;
}

export interface Paperwork {
  readonly caseId: string;
  readonly familyName: string;
  readonly createdAt: number;
  /** どの発言までを見て作ったか */
  readonly basedOn: number;
  readonly summary: string;
  readonly todos: readonly (PaperworkDraft["todos"][number] & { readonly source: "ai" | "board" | "template" })[];
  readonly sheets: readonly OrderSheet[];
  readonly askFamily: readonly string[];
}

export const PAPERWORK_SYSTEM = `あなたは葬儀社のベテラン担当者です。打合せが終わったあとの実務を、経験の浅い担当者のために片付けます。
会話の書き起こしと、決めることボードの状態（確定・候補・未定）を読み、次の3つを作ります。
1. 打合せのまとめ
2. 担当者の TODO（今日・明日にすること）
3. 発注書の下書き（発注の種類は与えた一覧の中から、この打合せで必要なものだけ。寺院・火葬場・安置室・受付・駐車場の手配は、電話や予約で済むので担当者の TODO として扱われる）

守ること：
- 書いてよいのは、会話にあることと決定の値だけ。数・日時・場所がわからないときは「要確認」と書き、推測で埋めない
- 金額は書かない
- 候補や未定の決定にもとづく発注も下書きとして作ってよいが、その数や内容は会話の言葉から離れない
- 家族の希望（好きだった花の色、故人の人柄など）は、業者への申し送りとして短く残す
- 有料の追加や上のランクを勧める内容を書かない
- すべて日本語で書く`;

export function paperworkPrompt(state: CaseState): string {
  const transcript = state.utterances.map((u) => `${u.id} ${u.speakerLabel}：${u.text}`).join("\n");
  const board = buildChecklist(state)
    .filter((r) => r.status !== "open")
    .map((r) => `- ${r.decisionId}（${r.label}）：${r.status === "confirmed" ? "確定" : "候補"}「${r.value}」`);
  const orders = buildOrders(state).map((o) => `- ${o.id}（${o.label}）：${o.status === "ready" ? "発注できる" : o.status === "not_needed" ? "不要" : `確定待ち（${o.waitingFor.join("・")}）`}`);
  return `# 家族\n${state.familyName}\n\n# 会話の書き起こし\n${transcript}\n\n# 決めることボード（確定・候補のみ）\n${board.join("\n") || "- まだありません"}\n\n# 拾い上げた事情\n${state.circumstances.map((c) => `- ${c.text}`).join("\n") || "- なし"}\n\n# 発注の種類と状態\n${orders.join("\n")}`;
}

/** 金額らしい書き方（発注書に金額は書かない） */
const MONEY = /[0-9０-９〇一二三四五六七八九十百千万]+\s*(?:円|万円)|¥|￥/;

/** モデルの下書きの文章を点検する（不安・多数派・急かし・上乗せ・日本語・金額） */
export function checkPaperwork(draft: PaperworkDraft): GuardViolation[] {
  const texts = [
    draft.summary,
    ...draft.todos.map((t) => `${t.task} ${t.when}`),
    ...draft.orders.flatMap((o) => [o.notes, o.deliverAt, o.deliverTo, ...o.items.map((i) => `${i.name} ${i.quantity} ${i.note}`)]),
    ...draft.askFamily,
  ];
  // 数量（30個・25名分）は書いてよいので、割合・件数の規則は外し、金額だけを別に見る
  const violations = texts.flatMap((t) => checkText(t)).filter((v) => v.rule !== "numbers_in_text");
  const money = texts.find((t) => MONEY.test(t));
  return money ? [...violations, { rule: "numbers_in_text", message: "発注書の下書きに金額を書いています（金額は書かない）", quote: money.slice(0, 40) }] : violations;
}

/** 下書きに、確定の状態・業者・ボードの未確定の項目を足して、画面と発注書に出す形にする */
export function assemblePaperwork(state: CaseState, draft: PaperworkDraft, now = Date.now()): Paperwork {
  const known = new Set(state.utterances.map((u) => u.id));
  const status = new Map(buildOrders(state).map((o) => [o.id, o]));
  const seen = new Set<string>();
  const sheets: OrderSheet[] = draft.orders.flatMap((o) => {
    const row = status.get(o.orderId);
    if (!row || row.status === "not_needed" || seen.has(o.orderId) || ARRANGE_BY_PHONE.has(o.orderId)) return [];
    seen.add(o.orderId);
    return [
      {
        orderId: o.orderId,
        label: row.label,
        vendor: VENDOR_OF[o.orderId] ?? row.label,
        status: row.status,
        waitingFor: row.waitingFor,
        items: o.items,
        deliverAt: o.deliverAt,
        deliverTo: o.deliverTo,
        notes: o.notes,
        utteranceIds: o.utteranceIds.filter((id) => known.has(id)),
        blanks: countBlanks(o),
      },
    ];
  });
  // 今日決める必要があり、まだ確定していない項目は、AI の TODO とは別に必ず載せる。
  // 迷いやすい項目は1つずつ、それ以外はまとめて1行にする（TODO が埋もれないように）
  const open = buildChecklist(state).filter((r) => r.dueToday);
  const hard = open.filter((r) => getDecision(r.decisionId).hard);
  const rest = open.length - hard.length;
  const board = [
    ...hard.map((r) => ({ task: `ご家族と決める：${r.label}`, when: "今日の打合せのうちに", stage: "打合せ" as const, decisionIds: [r.decisionId], utteranceIds: [], source: "board" as const })),
    ...(rest > 0
      ? [{ task: `ほかに今日決める項目が ${rest} 件あります（決めることボードを見る）`, when: "今日の打合せのうちに", stage: "打合せ" as const, decisionIds: [], utteranceIds: [], source: "board" as const }]
      : []),
  ];
  // 電話や予約で済む手配は、発注書ではなく TODO にする（同じ手配は1つにまとめる）
  const arranged = new Set<string>();
  const phoneTodos = draft.orders.flatMap((o) => {
    const row = status.get(o.orderId);
    if (!row || row.status === "not_needed" || !ARRANGE_BY_PHONE.has(o.orderId) || arranged.has(o.orderId)) return [];
    arranged.add(o.orderId);
    const detail = [o.items.map((i) => i.name).join("・"), o.notes].filter(Boolean).join("。");
    const waiting = row.status === "waiting" ? `（確定待ち：${row.waitingFor.join("・")}）` : "";
    return [{ task: `${row.label}${waiting}：${detail}`, when: o.deliverAt, stage: (o.orderId === "crematorium" ? "打合せ前" : "手配") as TodoStage, decisionIds: [], utteranceIds: o.utteranceIds.filter((id) => known.has(id)), source: "ai" as const }];
  });
  const aiTodos = [
    ...draft.todos.map((t) => ({ ...t, utteranceIds: t.utteranceIds.filter((id) => known.has(id)), source: "ai" as const })),
    ...phoneTodos,
  ];
  const templateTodos = TEMPLATE_TODOS.map((t) => ({ ...t, decisionIds: [], utteranceIds: [], source: "template" as const }));
  return {
    caseId: state.caseId,
    familyName: state.familyName,
    createdAt: now,
    basedOn: state.utterances.length,
    summary: draft.summary,
    todos: sortTodos([...aiTodos, ...board, ...templateTodos]),
    sheets: [...sheets].sort((a, b) => Number(!isSendable(a)) - Number(!isSendable(b)) || Number(a.status !== "ready") - Number(b.status !== "ready")),
    askFamily: draft.askFamily,
  };
}

export function decisionLabel(id: string): string {
  return getDecision(id).label;
}

export type GeneratePaperwork = (system: string, prompt: string) => Promise<PaperworkDraft>;

export type PaperworkResult =
  | { readonly ok: true; readonly paperwork: Paperwork; readonly attempts: number }
  | { readonly ok: false; readonly violations: readonly GuardViolation[]; readonly attempts: number };

/** 生成 → 点検。落ちたら指摘を添えて1回だけ作り直す */
export async function draftPaperwork(state: CaseState, generate: GeneratePaperwork, now = Date.now()): Promise<PaperworkResult> {
  const base = paperworkPrompt(state);
  let prompt = base;
  let violations: GuardViolation[] = [];
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const draft = PaperworkDraftSchema.parse(await generate(PAPERWORK_SYSTEM, prompt));
    violations = checkPaperwork(draft);
    if (violations.length === 0) return { ok: true, paperwork: assemblePaperwork(state, draft, now), attempts: attempt };
    prompt = `${base}\n\n# 前回の下書きは次の理由で出せませんでした。直してください\n${violations.map((v) => `- ${v.message}${v.quote ? `（「${v.quote}」）` : ""}`).join("\n")}`;
  }
  return { ok: false, violations, attempts: 2 };
}

/** TODO を段取りの順（打合せ前 → 打合せ → 手配 → 作成・用意 → 施行後）に並べる。同じ段取りの中は元の順を保つ */
export function sortTodos<T extends { readonly stage: TodoStage }>(todos: readonly T[]): T[] {
  return todos
    .map((t, i) => ({ t, i }))
    .sort((a, b) => TODO_STAGES.indexOf(a.t.stage) - TODO_STAGES.indexOf(b.t.stage) || a.i - b.i)
    .map(({ t }) => t);
}
