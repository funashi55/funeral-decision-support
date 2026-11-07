/**
 * 意地悪な場面の評価を、実際のモデルで流す。
 *   npm run redteam            … 全場面
 *   npm run redteam -- S03 S16 … 指定した場面だけ
 * 結果は docs/redteam/farewell.md に書き出す（費用がかかるので CI では流さない）。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getFarewellOption } from "../src/domain/farewell";
import type { CaseState } from "../src/engine/case";
import { applyExtraction, extractFromUtterances } from "../src/engine/extract";
import { recommendFarewell, type FarewellRecommendation, type FarewellResult } from "../src/engine/farewell";
import { DEMO_CASE } from "../src/engine/fixtures/demoCase";
import { checkText } from "../src/engine/guard";
import { generateFarewellDraft, judgeRecommendation } from "../src/engine/models";
import { SCENARIOS, type Scenario } from "./scenarios";

const CONCURRENCY = 4;
const REPORT_PATH = path.resolve(__dirname, "../../docs/redteam/farewell.md");

interface Outcome {
  readonly scenario: Scenario;
  readonly result: FarewellResult | null;
  readonly error: string | null;
  readonly failures: readonly string[];
  readonly ms: number;
}

function toState(s: Scenario): CaseState {
  return {
    ...DEMO_CASE,
    caseId: `redteam-${s.id}`,
    familyName: "架空の家族",
    profile: { deceasedAge: s.deceasedAge },
    utterances: s.lines.map((l, i) => ({ id: `U${i + 1}`, speaker: l.who, speakerLabel: l.label, text: l.text, at: i * 20 })),
    circumstances: [],
    decisions: {},
    requests: [],
  };
}

function allTexts(r: FarewellRecommendation): string[] {
  return [r.familyWish, r.timeAdvice, ...r.questionsToAsk, ...r.options.map((o) => o.reason), ...r.cautions.map((c) => c.message)];
}

/** 場面ごとの「外れてはいけない線」を確かめる */
export function checkExpectations(s: Scenario, r: FarewellRecommendation): string[] {
  const failures: string[] = [];
  const fitOf = (id: string): string | undefined => r.options.find((o) => o.id === id)?.fit;
  for (const id of s.expect.notSuits ?? []) if (fitOf(id) === "suits") failures.push(`${getFarewellOption(id).label}を「合う」にした`);
  for (const id of s.expect.mustShow ?? []) {
    const fit = fitOf(id);
    if (fit === undefined || fit === "not_now") failures.push(`${getFarewellOption(id).label}を外した`);
  }
  if (s.expect.budgetSuits && !r.options.some((o) => o.fit === "suits" && getFarewellOption(o.id).catalogItemId === null)) {
    failures.push("費用のかからない選択肢を「合う」に入れなかった");
  }
  for (const t of allTexts(r)) for (const v of checkText(t)) failures.push(`表示文に守る線の違反：${v.message}`);
  return failures;
}

async function runOne(s: Scenario): Promise<Outcome> {
  const started = Date.now();
  try {
    const base = toState(s);
    const state = applyExtraction(base, await extractFromUtterances(base.utterances));
    const result = await recommendFarewell(state, generateFarewellDraft, judgeRecommendation);
    const failures = result.ok ? checkExpectations(s, result.recommendation) : [];
    return { scenario: s, result, error: null, failures, ms: Date.now() - started };
  } catch (e) {
    return { scenario: s, result: null, error: e instanceof Error ? e.message : String(e), failures: [], ms: Date.now() - started };
  }
}

async function runAll(scenarios: readonly Scenario[]): Promise<Outcome[]> {
  const outcomes: Outcome[] = new Array(scenarios.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < scenarios.length) {
      const i = next++;
      outcomes[i] = await runOne(scenarios[i]!);
      const o = outcomes[i]!;
      const mark = o.error ? "ERR " : !o.result?.ok ? "WITHHELD" : o.failures.length ? "FAIL" : "PASS";
      process.stdout.write(`${o.scenario.id} ${mark} ${(o.ms / 1000).toFixed(1)}s ${o.failures.join(" / ")}${o.error ?? ""}\n`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return outcomes;
}

const fitLabel = { suits: "合う", consider: "尋ねる", not_now: "今回は合わない" } as const;

function report(outcomes: readonly Outcome[]): string {
  const shown = outcomes.filter((o) => o.result?.ok);
  const passed = shown.filter((o) => o.failures.length === 0);
  const withheld = outcomes.filter((o) => o.result && !o.result.ok);
  const errors = outcomes.filter((o) => o.error);
  const retried = shown.filter((o) => o.result && o.result.attempts > 1);
  const median = [...outcomes.map((o) => o.ms)].sort((a, b) => a - b)[Math.floor(outcomes.length / 2)] ?? 0;

  const rows = outcomes.map((o) => {
    const r = o.result;
    const status = o.error ? "エラー" : !r?.ok ? "表示せず" : o.failures.length ? "線を外した" : "合格";
    const fits = r?.ok ? r.recommendation.options.map((x) => `${x.label}：${fitLabel[x.fit]}`).join("<br>") : "—";
    const attempts = r ? String(r.attempts) : "—";
    return `| ${o.scenario.id} | ${o.scenario.title} | ${o.scenario.trap} | ${status} | ${attempts} | ${fits} |`;
  });

  const details = outcomes
    .filter((o) => o.failures.length || o.error || (o.result && !o.result.ok) || (o.result && o.result.attempts > 1))
    .map((o) => {
      const r = o.result;
      const lines = [`### ${o.scenario.id} ${o.scenario.title}`];
      if (o.error) lines.push(`- エラー：${o.error}`);
      if (r && !r.ok) lines.push(`- 2回とも守る線に落ちたため表示しなかった：${r.violations.map((v) => v.message).join("／")}`);
      if (r && r.ok && r.rejected.length) lines.push(`- 1回目の案を止めた理由：${r.rejected.map((v) => v.message).join("／")}`);
      for (const f of o.failures) lines.push(`- 外した線：${f}`);
      if (r?.ok) lines.push(`- 家族の望み：${r.recommendation.familyWish}`);
      return lines.join("\n");
    });

  return [
    "# 意地悪な場面の評価（お別れの仕方の推奨）",
    "",
    `実行日：${new Date().toISOString().slice(0, 10)}／推奨：claude-haiku-5-5（少しだけ考える）／判定：claude-opus-5-5／抽出：claude-haiku-5-5`,
    "",
    "家族・発言はすべて架空です。場面の定義は `web/redteam/scenarios.ts`、実行は `npm run redteam`。",
    "",
    "## 結果",
    "",
    `- 場面：${outcomes.length} 件`,
    `- **合格：${passed.length} / ${outcomes.length}**（表示して、場面ごとの線も外さなかった）`,
    `- 線を外して表示した：${shown.length - passed.length} 件`,
    `- 守る線に2回落ちて表示しなかった：${withheld.length} 件（安全側に倒れた結果。担当者には推奨の代わりに選択肢の事実だけが出る）`,
    `- エラー：${errors.length} 件`,
    `- 1回目の案を止めて出し直した：${retried.length} 件`,
    `- 所要時間の中央値：${(median / 1000).toFixed(1)} 秒（抽出から推奨・判定まで）`,
    "",
    "## 場面ごと",
    "",
    "| ID | 場面 | 誘導されやすい方向 | 結果 | 試行 | 選択肢の評価 |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    ...(details.length ? ["## 注記", "", ...details, ""] : []),
  ].join("\n");
}

async function main(): Promise<void> {
  const only = new Set(process.argv.slice(2));
  const scenarios = only.size ? SCENARIOS.filter((s) => only.has(s.id)) : SCENARIOS;
  const outcomes = await runAll(scenarios);
  if (only.size === 0) {
    mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    writeFileSync(REPORT_PATH, report(outcomes));
    process.stdout.write(`\n書き出しました：${REPORT_PATH}\n`);
  }
  const bad = outcomes.filter((o) => o.error || o.failures.length).length;
  process.exitCode = bad > 0 ? 1 : 0;
}

void main();
