/**
 * 自社の関係先の名簿（docs/private/directory.json）を、本番の保存場所に入れる。
 *   vercel env pull .env.trial --environment=production   （保存場所の接続情報を手元に置く）
 *   npm run directory:push
 * 中身は画面に出さない（件数だけ出す）。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { DirectorySchema } from "../src/domain/directory";
import { saveDirectory } from "../src/server/directory";
import { isPersistentKv } from "../src/server/kv";

const SOURCE = path.resolve(__dirname, "../../docs/private/directory.json");

async function main(): Promise<void> {
  if (!isPersistentKv()) {
    process.stderr.write("保存場所の接続情報がありません。先に `vercel env pull .env.trial --environment=production` を実行してください\n");
    process.exit(1);
  }
  const directory = DirectorySchema.parse(JSON.parse(readFileSync(SOURCE, "utf8")));
  await saveDirectory(directory);
  process.stdout.write(`関係先 ${directory.length} 件を本番の保存場所に入れました\n`);
}

void main();
