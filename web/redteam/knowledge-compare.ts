/**
 * 知見の前後比較（F9）。聞き取りの前の知見（作者のメモ）と、今の知見（聞き取りの後）で推奨を出し、
 * ベテランの答えとの一致率を比べる。
 *   npm run compare:knowledge
 *   npm run compare:knowledge -- --respondent ベテランA   （答えた人を選ぶ。省くと最後に送った人）
 * /veteran で集めた答え（npm run trial:pull で docs/private/veteran/answers.json に取り出したもの）があれば、それを正解にする。
 * 結果は docs/redteam/knowledge-compare.md に書き出す（モデルを呼ぶので費用がかかる）。
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getFarewellOption } from "../src/domain/farewell";
import type { CaseState } from "../src/engine/case";
import { applyExtraction, extractFromUtterances } from "../src/engine/extract";
import { recommendFarewell } from "../src/engine/farewell";
import { DEMO_CASE } from "../src/engine/fixtures/demoCase";
import { generateFarewellDraft, judgeRecommendation } from "../src/engine/models";
import before from "../src/knowledge/rules.author-memo.json";
import { loadKnowledge, type Knowledge } from "../src/knowledge/rules";
import { agreementOf, rate, type Agreement } from "./agreement";
import { SCENES as AUTHOR_SCENES, type Fit, type JudgmentScene } from "./judgment-scenes";
import { applyVeteranAnswers, pickSubmission, type Submission } from "./veteranAnswers";

const ANSWERS_PATH = path.resolve(__dirname, "../../docs/private/veteran/answers.json");

function loadSubmission(): Submission | undefined {
  if (!existsSync(ANSWERS_PATH)) return undefined;
  const all = JSON.parse(readFileSync(ANSWERS_PATH, "utf8")) as Submission[];
  const flag = process.argv.indexOf("--respondent");
  return pickSubmission(all, flag >= 0 ? process.argv[flag + 1] : undefined);
}

const submission = loadSubmission();
const SCENES = applyVeteranAnswers(AUTHOR_SCENES, submission);

const CONCURRENCY = 4;
const REPORT_PATH = path.resolve(__dirname, "../../docs/redteam/knowledge-compare.md");

interface Run {
  readonly scene: JudgmentScene;
  readonly agreement: Agreement | null;
  readonly note: string;
}

function toState(s: JudgmentScene): CaseState {
  return {
    ...DEMO_CASE,
    caseId: `compare-${s.id}`,
    familyName: "架空の家族",
    profile: { deceasedAge: s.deceasedAge, ...(s.daysUntilFuneral !== undefined ? { daysUntilFuneral: s.daysUntilFuneral } : {}) },
    utterances: s.lines.map((l, i) => ({ id: `U${i + 1}`, speaker: l.who, speakerLabel: l.label, text: l.text, at: i * 20 })),
    circumstances: [],
    decisions: {},
  };
}

async function runScene(scene: JudgmentScene, knowledge: Knowledge): Promise<Run> {
  try {
    const base = toState(scene);
    const state = applyExtraction(base, await extractFromUtterances(base.utterances));
    const result = await recommendFarewell(state, generateFarewellDraft, judgeRecommendation, knowledge);
    if (!result.ok) return { scene, agreement: null, note: "守る線に2回落ちて推奨を出さなかった" };
    const fits = new Map<string, Fit>(result.recommendation.options.map((o) => [o.id, o.fit]));
    return { scene, agreement: agreementOf(scene, fits), note: "" };
  } catch (e) {
    return { scene, agreement: null, note: `エラー：${e instanceof Error ? e.message : String(e)}` };
  }
}

async function runAll(knowledge: Knowledge): Promise<Run[]> {
  const runs: Run[] = new Array(SCENES.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < SCENES.length) {
      const i = next++;
      runs[i] = await runScene(SCENES[i]!, knowledge);
      const r = runs[i]!;
      process.stdout.write(`[${knowledge.version}] ${r.scene.id} ${r.agreement ? `${r.agreement.matched}/${r.agreement.total}` : r.note}\n`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return runs;
}

const FIT_LABEL: Record<Fit | "missing", string> = { suits: "合う", consider: "尋ねる", not_now: "今回は合わない", missing: "出さず" };

function cell(r: Run): string {
  if (!r.agreement) return r.note;
  const misses = r.agreement.misses.map((m) => `${getFarewellOption(m.id).label}：${FIT_LABEL[m.expected]}→${FIT_LABEL[m.actual]}`).join("<br>");
  return `${r.agreement.matched}/${r.agreement.total}${misses ? `<br>${misses}` : ""}`;
}

async function main(): Promise<void> {
  const knowledgeBefore = loadKnowledge(before);
  const knowledgeAfter = loadKnowledge();
  const same = knowledgeBefore.version === knowledgeAfter.version;
  const runsBefore = await runAll(knowledgeBefore);
  const runsAfter = same ? runsBefore : await runAll(knowledgeAfter);
  const ok = (runs: Run[]): Agreement[] => runs.flatMap((r) => (r.agreement ? [r.agreement] : []));
  const provisional = SCENES.some((s) => s.answeredBy === "provisional");

  const report = [
    "# 知見の前後比較（お別れの仕方の推奨）",
    "",
    `実行日：${new Date().toISOString().slice(0, 10)}／推奨：claude-haiku-5-5（少しだけ考える）／判定：claude-opus-5-5／抽出：claude-haiku-5-5`,
    "",
    "場面は `web/redteam/judgment-scenes.ts`（すべて架空）、実行は `npm run compare:knowledge`。",
    provisional ? "\n> 答えの一部は作者の仮の答えです。ベテランが同じ場面に答えたら置き換えます。\n" : "",
    submission ? `\n> 正解はベテランの答え（${SCENES.filter((s) => s.answeredBy === "veteran").length}場面）。作者の仮の答えとベテランの答えの一致率は ${rate(AUTHOR_SCENES.flatMap((a, i) => (SCENES[i]!.answeredBy === "veteran" ? [agreementOf(SCENES[i]!, new Map(Object.entries(a.answer)))] : [])))}%。\n` : "",
    "## 結果",
    "",
    "| 知見 | 規則の数 | ベテランの答えとの一致率 |",
    "| --- | --- | --- |",
    `| 聞き取りの前（${knowledgeBefore.version}） | ${knowledgeBefore.rules.length} | **${rate(ok(runsBefore))}%** |`,
    same ? "| 聞き取りの後 | — | まだ聞き取りの知見に置き換えていません |" : `| 聞き取りの後（${knowledgeAfter.version}） | ${knowledgeAfter.rules.length} | **${rate(ok(runsAfter))}%** |`,
    "",
    "## 場面ごと",
    "",
    "| ID | 場面 | 聞き取りの前 | 聞き取りの後 |",
    "| --- | --- | --- | --- |",
    ...SCENES.map((s, i) => `| ${s.id} | ${s.title} | ${cell(runsBefore[i]!)} | ${same ? "—" : cell(runsAfter[i]!)} |`),
    "",
  ].join("\n");
  writeFileSync(REPORT_PATH, report);
  process.stdout.write(`\n書き出しました：${REPORT_PATH}\n`);
}

void main();
