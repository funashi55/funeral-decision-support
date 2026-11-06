"use client";
/**
 * 聞き取りの途中経過をこの端末に残す（閉じても続きから再開できる）。サーバーには場面ごとの最後に送るだけ。
 */
import { useState, useSyncExternalStore } from "react";
import type { FarewellOptionId } from "../../../domain/farewell";
import type { ExtractedJudgment, HearingTurn } from "../../../engine/hearing";

export type InputMode = "voice" | "chat";
export type Experience = "under1" | "1to3" | "3to10" | "over10";
export type Stage = "card" | "roleplay" | "debrief" | "fits" | "confirm" | "sent";
export type FitAnswer = "suits" | "consider" | "not_now" | "unknown";
export type Verdict = "agree" | "disagree" | "unsure";

export interface SceneProgress {
  readonly stage: Stage;
  readonly turns: readonly HearingTurn[];
  readonly revealed: readonly string[];
  readonly fits: Partial<Record<FarewellOptionId, FitAnswer>>;
  readonly judgments: readonly ExtractedJudgment[];
  readonly firstWords: string;
  readonly verdicts: Readonly<Record<number, Verdict>>;
  readonly notes: Readonly<Record<number, string>>;
}

export interface HearingDraft {
  readonly respondent: string;
  readonly experience: Experience | "";
  readonly mode: InputMode;
  readonly scenes: Readonly<Record<string, SceneProgress>>;
}

export const EMPTY_SCENE: SceneProgress = { stage: "card", turns: [], revealed: [], fits: {}, judgments: [], firstWords: "", verdicts: {}, notes: {} };
const EMPTY: HearingDraft = { respondent: "", experience: "", mode: "chat", scenes: {} };
const KEY = "veteran-hearing-v2";

let cachedRaw: string | null = null;
let cachedDraft: HearingDraft | null = null;

function readSaved(): HearingDraft | null {
  const raw = window.localStorage.getItem(KEY);
  if (raw === cachedRaw) return cachedDraft;
  cachedRaw = raw;
  try {
    cachedDraft = raw ? { ...EMPTY, ...(JSON.parse(raw) as HearingDraft) } : null;
  } catch {
    cachedDraft = null;
  }
  return cachedDraft;
}

const noSubscribe = (): (() => void) => () => {};

export interface HearingDraftApi {
  readonly draft: HearingDraft;
  readonly update: (fn: (d: HearingDraft) => HearingDraft) => void;
  readonly updateScene: (sceneId: string, fn: (s: SceneProgress) => SceneProgress) => void;
}

export function useHearingDraft(): HearingDraftApi {
  const saved = useSyncExternalStore(noSubscribe, readSaved, () => null);
  const [edited, setEdited] = useState<HearingDraft | null>(null);
  const draft = edited ?? saved ?? EMPTY;

  const update = (fn: (d: HearingDraft) => HearingDraft): void => {
    setEdited((prev) => {
      const next = fn(prev ?? readSaved() ?? EMPTY);
      window.localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  };
  const updateScene = (sceneId: string, fn: (s: SceneProgress) => SceneProgress): void =>
    update((d) => ({ ...d, scenes: { ...d.scenes, [sceneId]: fn(d.scenes[sceneId] ?? EMPTY_SCENE) } }));

  return { draft, update, updateScene };
}

/** 入口の合言葉が要る API を呼ぶ。失敗はわかる言葉の例外にする */
export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({ success: false, error: "応答を読み取れませんでした" }))) as { success: boolean; data?: T; error?: string };
  if (!json.success || json.data === undefined) throw new Error(json.error ?? "うまく届きませんでした。もう一度お試しください");
  return json.data;
}
