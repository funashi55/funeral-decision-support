/**
 * 打合せの記録：「打合せを終える」を押したときの、その回の要約と清書した会話。
 *
 * 守ること：
 *  - 決まったこと・候補は、モデルに書かせず、案件の決定から並べる（確定は人が行う）
 *  - 清書は、誤字・聞き間違い・言いよどみを整えるだけ。意味を変えない・言っていないことを足さない
 *    （発言ごとに元の文と並べて残し、長さが大きく変わった清書は採らずに元の文を使う）
 *  - 前回の記録のあとの発言だけをその回の記録にする
 */
import { z } from "zod";
import { DECISIONS } from "../domain/decisions";
import type { CaseState, Utterance } from "./case";

export const ReportDraftSchema = z.object({
  overview: z.string().describe("この回の打合せで話したことの要約。3〜5文。ご家族の気持ちに触れたところも入れる。会話にないことは書かない"),
  familyVoice: z
    .array(z.object({ text: z.string().describe("ご家族が大事にしたいこと・気がかり（ご家族の言葉に近く）"), utteranceIds: z.array(z.string()) }))
    .describe("ご家族の言葉として出た、大事にしたいこと・気がかり"),
  pending: z.array(z.string()).describe("まだ決まっていないこと・次に確かめること（会話に出たものだけ）"),
  nextSteps: z.array(z.string()).describe("担当者が次にすること（会話で約束したこと・手配）"),
});
export type ReportDraft = z.output<typeof ReportDraftSchema>;

export const CleanedSchema = z.object({
  lines: z.array(z.object({ id: z.string(), text: z.string().describe("清書した発言") })),
});
export type Cleaned = z.output<typeof CleanedSchema>;

export interface ReportLine {
  readonly id: string;
  readonly speakerLabel: string;
  readonly speaker: Utterance["speaker"];
  /** 文字起こしのまま */
  readonly original: string;
  /** 清書 */
  readonly text: string;
}

export interface MeetingReport {
  readonly id: string;
  readonly caseId: string;
  /** 第何回の打合せか */
  readonly number: number;
  readonly createdAt: number;
  readonly familyName: string;
  readonly staffName?: string;
  readonly overview: string;
  readonly familyVoice: readonly { readonly text: string; readonly utteranceIds: readonly string[] }[];
  readonly pending: readonly string[];
  readonly nextSteps: readonly string[];
  /** 案件の決定から（モデルは書かない） */
  readonly decided: readonly { readonly label: string; readonly value: string }[];
  readonly candidates: readonly { readonly label: string; readonly value: string }[];
  readonly transcript: readonly ReportLine[];
}

export type ReportModel = (system: string, prompt: string) => Promise<ReportDraft>;
export type CleanModel = (system: string, prompt: string) => Promise<Cleaned>;

/** 清書の1回に渡す発言の数（長い打合せは分けて頼む） */
export const CLEAN_CHUNK = 60;
/** 清書が元の文からこれ以上ずれたら採らない（長さの比） */
const MIN_RATIO = 0.5;
const MAX_RATIO = 1.6;

/** 前回の記録のあとの発言 */
export function utterancesSince(state: CaseState, last: MeetingReport | undefined): Utterance[] {
  if (!last) return [...state.utterances];
  const lastId = last.transcript.at(-1)?.id;
  const i = state.utterances.findIndex((u) => u.id === lastId);
  return i >= 0 ? state.utterances.slice(i + 1) : [...state.utterances];
}

const line = (u: Utterance): string => `[${u.id}] ${u.speakerLabel}：${u.text}`;

export const REPORT_SYSTEM = `葬儀社の担当者のために、ご家族との打合せの記録を書きます。
- 会話にあることだけを書く。推測で足さない。金額・数字は会話に出たものだけ
- ご家族の気持ちには敬意をもって触れる。評価や助言は書かない
- 要約は、あとから読んだ別の担当者にも事情がわかるように`;

export const CLEAN_SYSTEM = `打合せの文字起こしを清書します。
- 誤字・変換の誤り・聞き間違い・言いよどみ（えー、あの）・言い直しを整え、読みやすい文にする
- 意味を変えない。言っていないことを足さない。話した人の口調（です・ます／くだけた言い方）は残す
- 発言は1つも抜かず、同じ ID で同じ順に返す`;

export function reportPrompt(state: CaseState, lines: readonly Utterance[]): string {
  return `# ご家族
${state.familyName}

# この回の会話
${lines.map(line).join("\n")}`;
}

/** 清書を発言に当てる。抜けた発言・ずれすぎた清書は元の文のまま */
export function applyCleaned(lines: readonly Utterance[], cleaned: readonly { readonly id: string; readonly text: string }[]): ReportLine[] {
  const byId = new Map(cleaned.map((c) => [c.id, c.text.trim()]));
  return lines.map((u) => {
    const c = byId.get(u.id);
    const ratio = c ? c.length / Math.max(u.text.length, 1) : 0;
    const ok = c !== undefined && c.length > 0 && ratio >= MIN_RATIO && ratio <= MAX_RATIO;
    return { id: u.id, speaker: u.speaker, speakerLabel: u.speakerLabel, original: u.text, text: ok ? c : u.text };
  });
}

async function clean(lines: readonly Utterance[], model: CleanModel): Promise<ReportLine[]> {
  const chunks = Array.from({ length: Math.ceil(lines.length / CLEAN_CHUNK) }, (_, i) => lines.slice(i * CLEAN_CHUNK, (i + 1) * CLEAN_CHUNK));
  const results = await Promise.all(
    chunks.map((chunk) =>
      model(CLEAN_SYSTEM, chunk.map(line).join("\n"))
        .then((r) => r.lines)
        .catch(() => []),
    ),
  );
  return applyCleaned(lines, results.flat());
}

/** 決まったこと・候補（案件の決定から） */
export function decisionsOf(state: CaseState): Pick<MeetingReport, "decided" | "candidates"> {
  const rows = DECISIONS.flatMap((d) => {
    const s = state.decisions[d.id];
    return s ? [{ label: d.label, value: s.value, status: s.status }] : [];
  });
  return {
    decided: rows.filter((r) => r.status === "confirmed").map(({ label, value }) => ({ label, value })),
    candidates: rows.filter((r) => r.status === "candidate").map(({ label, value }) => ({ label, value })),
  };
}

/** この回の記録を作る */
export async function buildReport(
  state: CaseState,
  previous: readonly MeetingReport[],
  models: { readonly summarize: ReportModel; readonly clean: CleanModel },
  at: number,
  id: string,
): Promise<MeetingReport | undefined> {
  const lines = utterancesSince(state, previous.at(-1));
  if (lines.length === 0) return undefined;
  const known = new Set(lines.map((u) => u.id));
  const [draft, transcript] = await Promise.all([models.summarize(REPORT_SYSTEM, reportPrompt(state, lines)), clean(lines, models.clean)]);
  return {
    id,
    caseId: state.caseId,
    number: previous.length + 1,
    createdAt: at,
    familyName: state.familyName,
    staffName: state.registration?.staffName,
    overview: draft.overview.trim(),
    familyVoice: draft.familyVoice.map((v) => ({ text: v.text.trim(), utteranceIds: v.utteranceIds.filter((x) => known.has(x)) })).filter((v) => v.text),
    pending: draft.pending.map((x) => x.trim()).filter(Boolean),
    nextSteps: draft.nextSteps.map((x) => x.trim()).filter(Boolean),
    ...decisionsOf(state),
    transcript,
  };
}
