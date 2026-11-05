/**
 * 試用で集めたもの（ベテランの答え・感想）を、公開しない docs/private/ に取り出す。
 *   vercel env pull .env.trial --environment=production   （保存場所の接続情報を手元に置く）
 *   npm run trial:pull
 * 書き出し先：docs/private/veteran/answers.json（npm run compare:knowledge が読む）、docs/private/veteran/notes.md
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { isPersistentKv } from "../src/server/kv";
import { listNotes, listVeteranSubmissions } from "../src/server/trialFeedback";

const OUT_DIR = path.resolve(__dirname, "../../docs/private/veteran");

async function main(): Promise<void> {
  if (!isPersistentKv()) {
    process.stderr.write("保存場所の接続情報がありません。先に `vercel env pull .env.trial --environment=production` を実行してください\n");
    process.exit(1);
  }
  const submissions = await listVeteranSubmissions();
  const notes = await listNotes();
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(path.join(OUT_DIR, "answers.json"), `${JSON.stringify(submissions, null, 2)}\n`);
  const lines = [
    "# 試用の感想",
    "",
    ...notes.map((n) => `- ${new Date(n.at).toISOString().slice(0, 16).replace("T", " ")}｜${n.name || "（名前なし）"}｜${n.page}\n  ${n.text.replace(/\n/g, "\n  ")}`),
    "",
    "# 場面への答えに添えられた全体の感想",
    "",
    ...submissions.filter((s) => s.comment).map((s) => `- ${s.respondent}：${s.comment.replace(/\n/g, "\n  ")}`),
    "",
  ];
  writeFileSync(path.join(OUT_DIR, "notes.md"), lines.join("\n"));
  process.stdout.write(`答え ${submissions.length} 件・感想 ${notes.length} 件を ${OUT_DIR} に書き出しました\n`);
}

void main();
