/**
 * 即答の層を決めるための比べ：判断の場面ごとに、お別れの仕方の各選択肢が「合う／尋ねてみる／今回は合わない」のどれかを、
 * Jev（TypeSafe の判断専用モデル）・Haiku・Opus に答えさせ、作者の答えとの一致率と所要時間を比べる。
 *   npx tsx --env-file=.env.local scripts/fit-bench.ts [出力先.json]
 * 環境変数：TYPESAFE_API_KEY（Jev。なければ Jev は飛ばす）、JEV_MODEL（既定 jev-latest）、ANTHROPIC_API_KEY、MODELS（例 jev,haiku）
 */
import { writeFileSync } from "node:fs";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { agreementOf, rate, type Agreement } from "../redteam/agreement";
import { FITS, SCENES, type Fit, type JudgmentScene } from "../src/data/judgmentScenes";
import { FAREWELL_OPTIONS } from "../src/domain/farewell";
import { MODEL_FAST, MODEL_REASONING, getClient } from "../src/engine/client";

const JEV_URL = "https://api.typesafe.ai/v1/systemone";
const JEV_MODEL = process.env.JEV_MODEL ?? "jev-latest";
const ONLY = process.env.MODELS?.split(",");

const GUIDE = `葬儀社のベテラン担当者として、打合せでのお別れの仕方の選択肢を見立てる。
- 合う：家族の言葉や事情からみて、この家族に向いている
- 尋ねてみる：向くかもしれないので、勧めずに望むかを尋ねる
- 今回は合わない：事情からみて、今回は向かない
有料の選択肢を勧めるために不安をあおらない。費用を抑えたい家族には、費用のかからない選択肢を必ず残す。`;

const CRITERIA: Record<Fit, string> = {
  suits: "合う：この家族の言葉や事情からみて向いている",
  consider: "尋ねてみる：向くかもしれないので、勧めずに望むかを尋ねる",
  not_now: "今回は合わない：事情からみて今回は向かない",
};

function sceneText(scene: JudgmentScene): string {
  const lines = scene.lines.map((l) => `${l.label}：${l.text}`).join("\n");
  const days = scene.daysUntilFuneral ? `受付から葬儀まで${scene.daysUntilFuneral}日の見込み。` : "";
  return `故人は${scene.deceasedAge}歳。${days}\n${lines}`;
}

function optionText(id: string): string {
  const o = FAREWELL_OPTIONS.find((x) => x.id === id)!;
  return `「${o.label}」：${o.summary} できること：${o.canDo.join("、")}。できないこと：${o.cannotDo.join("、")}。`;
}

type Judge = (scene: JudgmentScene, optionIds: readonly string[]) => Promise<Map<string, Fit>>;

const jev: Judge = async (scene, optionIds) => {
  const questions = Object.fromEntries(
    optionIds.map((id) => [id, { type: "choice", instructions: `${GUIDE}\nこの家族に、お別れの仕方${optionText(id)}はどう合うか。`, criteria: CRITERIA }]),
  );
  const res = await fetch(JEV_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.TYPESAFE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ state: sceneText(scene), model: JEV_MODEL, questions }),
  });
  if (!res.ok) throw new Error(`Jev ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { answers: Record<string, { choice: Fit }> };
  return new Map(optionIds.map((id) => [id, body.answers[id]!.choice]));
};

function claudeJudge(model: string, effort?: "low"): Judge {
  return async (scene, optionIds) => {
    const schema = z.object({ fits: z.object(Object.fromEntries(optionIds.map((id) => [id, z.enum(FITS as [Fit, ...Fit[]])]))) });
    const response = await getClient().messages.parse({
      model,
      max_tokens: 1000,
      system: GUIDE,
      ...(effort ? { output_config: { effort, format: zodOutputFormat(schema) } } : { output_config: { format: zodOutputFormat(schema) } }),
      messages: [{ role: "user", content: `${sceneText(scene)}\n\n選択肢：\n${optionIds.map(optionText).join("\n")}` }],
    });
    const fits = (response.parsed_output as z.infer<typeof schema> | null)?.fits ?? {};
    return new Map(Object.entries(fits) as [string, Fit][]);
  };
}

const JUDGES: Record<string, Judge> = {
  jev,
  haiku: claudeJudge(MODEL_FAST),
  opus: claudeJudge(MODEL_REASONING, "low"),
};

async function main(): Promise<void> {
  const names = Object.keys(JUDGES).filter((n) => (!ONLY || ONLY.includes(n)) && (n !== "jev" || process.env.TYPESAFE_API_KEY));
  const results: Record<string, { agreement: number; medianMs: number; maxMs: number; perScene: unknown[]; errors: string[] }> = {};
  for (const name of names) {
    const agreements: Agreement[] = [];
    const times: number[] = [];
    const perScene: unknown[] = [];
    const errors: string[] = [];
    for (const scene of SCENES) {
      const ids = Object.keys(scene.answer);
      const t0 = performance.now();
      try {
        const fits = await JUDGES[name]!(scene, ids);
        const ms = Math.round(performance.now() - t0);
        const a = agreementOf(scene, fits);
        agreements.push(a);
        times.push(ms);
        perScene.push({ id: scene.id, ms, matched: a.matched, total: a.total, misses: a.misses });
      } catch (e) {
        errors.push(`${scene.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    const sorted = [...times].sort((a, b) => a - b);
    results[name] = { agreement: rate(agreements), medianMs: sorted[Math.floor(sorted.length / 2)] ?? 0, maxMs: sorted.at(-1) ?? 0, perScene, errors };
    process.stdout.write(`${name.padEnd(6)} 一致率 ${results[name]!.agreement}%  中央値 ${results[name]!.medianMs}ms  最大 ${results[name]!.maxMs}ms  エラー ${errors.length}\n`);
    for (const e of errors.slice(0, 2)) process.stdout.write(`  ${e}\n`);
  }
  const out = process.argv[2] ?? "fit-bench.json";
  writeFileSync(out, `${JSON.stringify({ at: new Date().toISOString(), jevModel: JEV_MODEL, results }, null, 2)}\n`);
  process.stdout.write(`詳細：${out}\n`);
}

void main();
