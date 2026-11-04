/**
 * 聞き取りの知見をまとめて、元の発言に戻れるかを確かめる。
 *   npm run knowledge -- <文字起こし.txt> <断片のフォルダ>          … 確かめるだけ
 *   npm run knowledge -- <文字起こし.txt> <断片のフォルダ> --write  … src/knowledge/rules.json を置き換える
 * 文字起こしと断片は docs/private/ に置く（公開しない）。
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { FragmentSchema, mergeFragments, traceToTranscript } from "../src/knowledge/extract";

const RULES_PATH = path.resolve(__dirname, "../src/knowledge/rules.json");

function main(): void {
  const [transcriptPath, fragmentDir, ...flags] = process.argv.slice(2);
  if (!transcriptPath || !fragmentDir) {
    process.stderr.write("使い方: npm run knowledge -- <文字起こし.txt> <断片のフォルダ> [--write]\n");
    process.exitCode = 2;
    return;
  }
  const transcript = readFileSync(transcriptPath, "utf8");
  const files = readdirSync(fragmentDir).filter((f) => f.endsWith(".json")).sort();
  const fragments = files.map((f) => FragmentSchema.parse(JSON.parse(readFileSync(path.join(fragmentDir, f), "utf8"))));
  const knowledge = mergeFragments(fragments, `veteran-interview-${new Date().toISOString().slice(0, 10)}`, "ベテランへの聞き取りから、テーマ別のサブエージェントが取り出した知見。すべて元の発言に戻れる。本人の確認を経たものだけを残す。");
  const problems = traceToTranscript(knowledge, transcript);

  for (const r of knowledge.rules) process.stdout.write(`${r.id} [${r.decisionIds.join(",")}] ${r.when} → ${r.do}\n`);
  process.stdout.write(`\n規則 ${knowledge.rules.length} 件（断片 ${files.length} ファイル）。元の発言に戻れない規則：${problems.length} 件\n`);
  for (const p of problems) process.stdout.write(`  ✗ ${p.ruleId} ${p.problem}\n`);

  if (problems.length > 0) {
    process.exitCode = 1;
    return;
  }
  if (flags.includes("--write")) {
    writeFileSync(RULES_PATH, `${JSON.stringify(knowledge, null, 2)}\n`);
    process.stdout.write(`書き出しました：${RULES_PATH}（聞き取りの前の知見は rules.author-memo.json に残してあります）\n`);
  }
}

main();
