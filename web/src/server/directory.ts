/**
 * 関係先の名簿の読み出し。デモは架空の名簿、本番は保存場所（Upstash）に入れた自社の名簿。
 * 自社の名簿はリポジトリに置かない（docs/private/directory.json → scripts/directory-push.ts で入れる）。
 */
import sample from "../data/directory.sample.json";
import type { CaseMode } from "../domain/caseMode";
import { DirectorySchema, type Place } from "../domain/directory";
import { getKv, type Kv } from "./kv";

export const DIRECTORY_KEY = "v1:directory";
/** 名簿は入れ直すまで残す（1年） */
export const DIRECTORY_TTL_SECONDS = 60 * 60 * 24 * 365;

const DEMO_DIRECTORY: readonly Place[] = DirectorySchema.parse(sample);

export async function loadDirectory(mode: CaseMode, kv: Kv = getKv()): Promise<readonly Place[]> {
  if (mode === "demo") return DEMO_DIRECTORY;
  const saved = DirectorySchema.safeParse((await kv.get<unknown>(DIRECTORY_KEY)) ?? []);
  return saved.success ? saved.data : [];
}

export async function saveDirectory(places: readonly Place[], kv: Kv = getKv()): Promise<void> {
  await kv.set(DIRECTORY_KEY, DirectorySchema.parse(places), DIRECTORY_TTL_SECONDS);
}
