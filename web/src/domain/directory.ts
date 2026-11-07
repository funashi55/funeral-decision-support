/**
 * 関係先の名簿（お寺・墓地・火葬場・会館）。会話や決めたことに名前が出たら、電話番号と地図を出す。
 * - デモの案件：架空の名簿（web/src/data/directory.sample.json）。電話番号はかからない形
 * - 本番の案件：自社の名簿。リポジトリには置かず、docs/private/directory.json から保存場所へ入れる（scripts/directory-push.ts）
 * 実在の寺院・取引先の名前と番号を公開ファイルに書かない。
 */
import { z } from "zod";

export const PLACE_KINDS = ["temple", "cemetery", "crematorium", "hall"] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];

export const PLACE_KIND_LABEL: Readonly<Record<PlaceKind, string>> = { temple: "お寺", cemetery: "墓地", crematorium: "火葬場", hall: "会館" };

export const PlaceSchema = z.object({
  id: z.string().min(1).max(64),
  kind: z.enum(PLACE_KINDS),
  name: z.string().trim().min(1).max(60),
  /** 会話での呼び方（「東光寺さん」「市の斎場」など） */
  aliases: z.array(z.string().trim().min(2).max(30)).max(10).default([]),
  sect: z.string().trim().max(30).optional(),
  address: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(30).optional(),
});
export type Place = z.output<typeof PlaceSchema>;

export const DirectorySchema = z.array(PlaceSchema).max(2000);

const squash = (s: string): string => s.replace(/[\s　]/g, "");

/** 呼び方の候補：名前そのもの・別名・山号を除いた寺号（「〇〇山 東光寺」→「東光寺」） */
function namesOf(p: Place): string[] {
  const base = squash(p.name).replace(/（.*?）|\(.*?\)/g, "");
  const temple = p.kind === "temple" ? base.replace(/^.*?山/, "") : base;
  return [...new Set([base, temple, ...p.aliases.map(squash)])].filter((n) => n.length >= 2);
}

/** 文章に名前が出ている関係先（並びは名簿の順） */
export function placesMentioned(directory: readonly Place[], texts: readonly string[]): Place[] {
  const all = squash(texts.join("\n"));
  return directory.filter((p) => namesOf(p).some((n) => all.includes(n)));
}

/** 地図の埋め込み。鍵（Maps Embed API）があれば正式の埋め込み、なければ鍵の要らない形 */
export function mapEmbedUrl(address: string, key?: string): string {
  const q = encodeURIComponent(address);
  return key
    ? `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=${q}&language=ja`
    : `https://maps.google.com/maps?q=${q}&hl=ja&z=15&output=embed`;
}

/** 経路の埋め込み（車） */
export function routeEmbedUrl(origin: string, destination: string, key?: string): string {
  const o = encodeURIComponent(origin);
  const d = encodeURIComponent(destination);
  return key
    ? `https://www.google.com/maps/embed/v1/directions?key=${encodeURIComponent(key)}&origin=${o}&destination=${d}&mode=driving&language=ja`
    : `https://maps.google.com/maps?saddr=${o}&daddr=${d}&hl=ja&output=embed`;
}

/** 地図アプリで経路を開く（スマホでは地図アプリが開く） */
export function routeLinkUrl(origin: string, destination: string): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}

/** 電話をかけるリンク（数字と + だけにする） */
export function telHref(phone: string): string {
  return `tel:${phone.normalize("NFKC").replace(/[^0-9+]/g, "")}`;
}
