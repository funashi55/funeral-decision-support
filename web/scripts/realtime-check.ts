/**
 * 実時間テスト：架空の打合せを人が話す間隔で流し、事情の拾い上げと推奨が打合せのテンポに間に合うか、中身が守る線を守るかを測る。
 *   npx tsx scripts/realtime-check.ts [出力先.json]
 * 環境変数：BASE_URL（既定 http://localhost:3200）、LINE_INTERVAL_MS（既定 12000）、FAMILIES（例 F1,F3。既定はすべて）
 * 画面と同じ API を同じ順に呼ぶ（発言を足す → 拾い上げを裏で走らせる → 区切りで推奨を出す）。家族はすべて同時に流す（複数の担当者が同時に使う想定）。
 */
import { writeFileSync } from "node:fs";
import type { CaseState } from "../src/engine/case";
import type { FarewellResult } from "../src/engine/farewell";
import { checkText } from "../src/engine/guard";
import { REALTIME_FAMILIES, type RealtimeFamily } from "./realtime-families";

const BASE = process.env.BASE_URL ?? "http://localhost:3200";
const INTERVAL = Number(process.env.LINE_INTERVAL_MS ?? 12000);
const ONLY = process.env.FAMILIES?.split(",");

interface Envelope<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
}

async function call<T>(path: string, body?: unknown): Promise<{ data?: T; error?: string; ms: number; status: number }> {
  const t0 = performance.now();
  const res = await fetch(`${BASE}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({ success: false, error: `HTTP ${res.status}` }))) as Envelope<T>;
  return { data: json.data, error: json.success ? undefined : json.error, ms: Math.round(performance.now() - t0), status: res.status };
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

interface Checkpoint {
  readonly afterLine: number;
  readonly ms: number;
  readonly ok: boolean;
  readonly error?: string;
  readonly attempts?: number;
  readonly rejectedRules?: readonly string[];
  readonly options?: readonly { id: string; label: string; fit: string; free: boolean; quotes: number; rules: readonly string[] }[];
  readonly hasFreeOption?: boolean;
  readonly guardHits?: readonly string[];
  readonly familyWish?: string;
  readonly timeAdvice?: string;
  readonly questions?: readonly string[];
  readonly cautions?: readonly string[];
  readonly references?: number;
}

function inspect(result: FarewellResult): Omit<Checkpoint, "afterLine" | "ms"> {
  if (!result.ok) return { ok: false, attempts: result.attempts, rejectedRules: result.violations.map((v) => v.rule) };
  const r = result.recommendation;
  const shown = r.options.filter((o) => o.fit !== "not_now");
  const texts = [r.familyWish, r.timeAdvice, ...r.questionsToAsk, ...r.options.map((o) => o.reason), ...r.cautions.map((c) => c.message)];
  return {
    ok: true,
    attempts: result.attempts,
    rejectedRules: result.rejected.map((v) => v.rule),
    options: r.options.map((o) => ({ id: o.id, label: o.label, fit: o.fit, free: o.price === null, quotes: o.evidence.utteranceIds.length, rules: o.evidence.rules.map((x) => x.id) })),
    hasFreeOption: shown.some((o) => o.price === null),
    guardHits: texts.flatMap((t) => checkText(t)).map((v) => `${v.rule}:${v.quote ?? ""}`),
    familyWish: r.familyWish,
    timeAdvice: r.timeAdvice,
    questions: r.questionsToAsk,
    cautions: r.cautions.map((c) => `${c.label}：${c.message}`),
    references: r.references.length,
  };
}

async function createCase(): Promise<string> {
  const res = await fetch(`${BASE}/api/trials`, { method: "POST", redirect: "manual" });
  const location = res.headers.get("location") ?? "";
  const id = location.split("/staff/")[1];
  if (!id) throw new Error(`案件を作れませんでした（HTTP ${res.status}）`);
  return id;
}

async function runFamily(f: RealtimeFamily) {
  const caseId = await createCase();
  const extracts: Promise<{ ms: number; error?: string }>[] = [];
  const checkpoints: Checkpoint[] = [];
  const started = performance.now();
  for (const [i, line] of f.lines.entries()) {
    const added = await call<CaseState>(`/api/cases/${caseId}/utterances`, { ...line, at: (i + 1) * 20 });
    if (added.error) throw new Error(`${f.id} 発言を足せませんでした：${added.error}`);
    // 画面と同じく、拾い上げは待たずに裏で走らせる
    extracts.push(call<CaseState>(`/api/cases/${caseId}/extract`, {}).then((r) => ({ ms: r.ms, error: r.error })));
    if (f.checkpoints.includes(i + 1)) {
      const res = await call<FarewellResult>(`/api/cases/${caseId}/farewell`, {});
      checkpoints.push(res.data ? { afterLine: i + 1, ms: res.ms, ...inspect(res.data) } : { afterLine: i + 1, ms: res.ms, ok: false, error: res.error });
      process.stdout.write(`${f.id} ${i + 1}行目のあと 推奨 ${res.ms}ms ${res.data?.ok ? "出た" : `出ず（${res.error ?? "判定で止まった"}）`}\n`);
    }
    if (i < f.lines.length - 1) await sleep(INTERVAL);
  }
  const extractResults = await Promise.all(extracts);
  const final = await call<CaseState>(`/api/cases/${caseId}`);
  const ms = extractResults.map((e) => e.ms).sort((a, b) => a - b);
  return {
    id: f.id,
    title: f.title,
    expect: f.expect,
    caseId,
    seconds: Math.round((performance.now() - started) / 1000),
    extract: {
      count: ms.length,
      errors: extractResults.filter((e) => e.error).map((e) => e.error),
      medianMs: ms[Math.floor(ms.length / 2)],
      maxMs: ms.at(-1),
      overInterval: ms.filter((x) => x > INTERVAL).length,
    },
    circumstances: final.data?.circumstances.map((c) => c.text) ?? [],
    candidates: Object.entries(final.data?.decisions ?? {}).map(([k, v]) => `${k}=${v.value}`),
    checkpoints,
  };
}

async function main(): Promise<void> {
  const families = REALTIME_FAMILIES.filter((f) => !ONLY || ONLY.includes(f.id));
  process.stdout.write(`${BASE} に ${families.length} 家族を同時に、${INTERVAL}ms 間隔で流します\n`);
  const settled = await Promise.allSettled(families.map(runFamily));
  const failed = settled.flatMap((s, i) => (s.status === "rejected" ? [{ id: families[i]!.id, error: String(s.reason) }] : []));
  const report = settled.flatMap((s) => (s.status === "fulfilled" ? [s.value] : []));
  const out = process.argv[2] ?? "realtime-report.json";
  writeFileSync(out, `${JSON.stringify({ base: BASE, intervalMs: INTERVAL, at: new Date().toISOString(), report, failed }, null, 2)}\n`);
  for (const f of failed) process.stdout.write(`\n${f.id}：失敗 ${f.error}\n`);
  for (const r of report) {
    const cps = r.checkpoints.map((c) => `${c.afterLine}行:${c.ok ? "○" : "×"}${c.ms}ms${c.ok ? (c.hasFreeOption ? "・無料あり" : "・無料なし") : ""}${c.guardHits?.length ? `・守る線${c.guardHits.length}` : ""}`);
    process.stdout.write(`\n${r.id} 拾い上げ 中央値${r.extract.medianMs}ms 最大${r.extract.maxMs}ms 間に合わず${r.extract.overInterval} エラー${r.extract.errors.length}｜推奨 ${cps.join(" ")}\n`);
  }
  process.stdout.write(`\n詳細：${out}\n`);
}

void main();
