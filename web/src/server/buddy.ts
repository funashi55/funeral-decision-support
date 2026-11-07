/**
 * 担当者ごとのバディ（設定・自分の言い方・使った記録）の保存。案件をまたいで育つので、案件（30日）とは別に1年残す。
 * デモと本番は別の箱に置き、デモで押したことが本番の担当者のバディに混ざらないようにする。
 */
import { caseMode } from "../domain/caseMode";
import { BuddyProfileSchema, emptyProfile, type BuddyProfile } from "../domain/buddy";
import type { CaseState } from "../engine/case";
import { getKv, type Kv } from "./kv";

export const BUDDY_TTL_SECONDS = 60 * 60 * 24 * 365;
/** 担当者の名前が入っていない案件のバディ */
export const UNNAMED_STAFF = "担当者";

export function staffOf(state: CaseState): string {
  return state.registration?.staffName?.trim() || UNNAMED_STAFF;
}

function keyOf(state: CaseState): string {
  return `v1:buddy:${caseMode(state.caseId) ?? "live"}:${staffOf(state)}`;
}

export async function loadBuddy(state: CaseState, kv: Kv = getKv()): Promise<BuddyProfile> {
  const saved = BuddyProfileSchema.safeParse(await kv.get<unknown>(keyOf(state)));
  return saved.success ? saved.data : emptyProfile(staffOf(state));
}

export async function saveBuddy(state: CaseState, profile: BuddyProfile, kv: Kv = getKv()): Promise<BuddyProfile> {
  const p = BuddyProfileSchema.parse({ ...profile, staffName: staffOf(state) });
  await kv.set(keyOf(state), p, BUDDY_TTL_SECONDS);
  return p;
}

/** 読んで、変えて、書く */
export async function updateBuddy(state: CaseState, change: (p: BuddyProfile) => BuddyProfile, kv: Kv = getKv()): Promise<BuddyProfile> {
  return saveBuddy(state, change(await loadBuddy(state, kv)), kv);
}

/** デモのバディを空に戻す（デモの「最初から」で使う。本番の担当者のバディは消さない） */
export async function resetDemoBuddy(state: CaseState, kv: Kv = getKv()): Promise<void> {
  if (caseMode(state.caseId) !== "demo") return;
  await kv.del(keyOf(state));
}
