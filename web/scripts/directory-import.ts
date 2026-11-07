/**
 * 自社の関係先の名簿を、Notion から書き出した CSV から作る（公開しない docs/private/directory.json に書く）。
 *   1. Notion のデータベース（寺・神社の一覧、墓地の一覧、火葬場・会館の一覧）を「CSV で書き出し」して docs/private/directory/ に置く
 *   2. npm run directory:import -- temple=寺.csv cemetery=墓地.csv crematorium=火葬場.csv hall=会館.csv
 *   3. npm run directory:push（本番の保存場所に入れる）
 * 取り出すのは名前・宗派・住所・電話だけ。寺院ごとのメモ（作法・関係者の話）は持ってこない。
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DirectorySchema, PLACE_KINDS, type Place, type PlaceKind } from "../src/domain/directory";

const PRIVATE_DIR = path.resolve(__dirname, "../../docs/private/directory");
const OUT = path.resolve(__dirname, "../../docs/private/directory.json");

/** CSV を行と列に分ける（引用符の中のカンマ・改行に対応） */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) rows.push([...row, cell]);
  return rows.filter((r) => r.some((c) => c.trim()));
}

/** Notion の関係（「宗派 (https://…)」）から名前だけを取る */
const plain = (v: string | undefined): string | undefined => {
  const t = v?.replace(/\s*\(https?:\/\/[^)]*\)/g, "").trim();
  return t ? t : undefined;
};

const pick = (header: readonly string[], row: readonly string[], names: readonly string[]): string | undefined => {
  const i = header.findIndex((h) => names.some((n) => h.trim().startsWith(n)));
  return i >= 0 ? plain(row[i]) : undefined;
};

export function placesFromCsv(kind: PlaceKind, text: string): Place[] {
  const [header = [], ...rows] = parseCsv(text);
  return rows.flatMap((row, i) => {
    const name = pick(header, row, ["名前", "名称"]);
    if (!name) return [];
    return [
      {
        id: `${kind}-${i + 1}`,
        kind,
        name,
        aliases: [],
        sect: kind === "temple" ? pick(header, row, ["宗派"]) : undefined,
        address: pick(header, row, ["住所"]),
        phone: pick(header, row, ["電話"]),
      },
    ];
  });
}

function main(): void {
  const args = process.argv.slice(2).map((a) => a.split("=") as [string, string]);
  const places = args.flatMap(([kind, file]) => {
    if (!PLACE_KINDS.includes(kind as PlaceKind) || !file) throw new Error(`「種類=ファイル名」で渡してください（種類：${PLACE_KINDS.join("・")}）`);
    return placesFromCsv(kind as PlaceKind, readFileSync(path.resolve(PRIVATE_DIR, file), "utf8"));
  });
  const directory = DirectorySchema.parse(places);
  writeFileSync(OUT, `${JSON.stringify(directory, null, 2)}\n`);
  process.stdout.write(`${directory.length} 件を docs/private/directory.json に書きました（${PLACE_KINDS.map((k) => `${k} ${directory.filter((p) => p.kind === k).length}`).join("・")}）\n`);
}

if (require.main === module) main();
