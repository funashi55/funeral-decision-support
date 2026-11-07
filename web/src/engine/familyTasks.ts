/**
 * ご家族へのお願い（調べていただくこと・ご用意いただくこと）。
 * 打合せの記録から下書きとして入り、担当者が書き直して「ご家族に見せる」にしたものだけが、ご家族の窓口の TODO に出る。
 * 済んだかどうかは、ご家族も担当者も付けられる。
 */
import { z } from "zod";
import type { CaseState } from "./case";

export const FAMILY_TASK_KINDS = ["research", "prepare"] as const;
export type FamilyTaskKind = (typeof FAMILY_TASK_KINDS)[number];
export const FAMILY_TASK_LABEL: Readonly<Record<FamilyTaskKind, string>> = { research: "調べていただくこと", prepare: "ご用意いただくこと" };

export interface FamilyTask {
  readonly id: string;
  readonly kind: FamilyTaskKind;
  readonly text: string;
  /** ご家族の窓口に出すか（担当者が決める） */
  readonly shared: boolean;
  readonly done: boolean;
  readonly at: number;
  /** どの回の打合せの記録から入ったか（担当者が足したものにはない） */
  readonly reportId?: string;
}

/** 一つの案件に置くお願いの数の上限 */
const MAX_TASKS = 60;
export const TaskTextSchema = z.string().trim().min(2, "内容を入れてください").max(120, "120文字までにしてください");

const newId = (): string => `ft-${globalThis.crypto.randomUUID().slice(0, 13)}`;
const squash = (s: string): string => s.replace(/[\s　、。]/g, "");

/** 記録から下書きを足す（同じ内容がすでにあれば足さない） */
export function addDrafts(state: CaseState, drafts: readonly { readonly kind: FamilyTaskKind; readonly text: string }[], at: number, reportId?: string): CaseState {
  const have = new Set((state.familyTasks ?? []).map((t) => squash(t.text)));
  const added: FamilyTask[] = [];
  for (const d of drafts) {
    const text = TaskTextSchema.safeParse(d.text);
    if (!text.success || have.has(squash(text.data))) continue;
    have.add(squash(text.data));
    added.push({ id: newId(), kind: d.kind, text: text.data, shared: false, done: false, at, reportId });
  }
  return { ...state, familyTasks: [...(state.familyTasks ?? []), ...added].slice(-MAX_TASKS) };
}

export const TaskActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add"), kind: z.enum(FAMILY_TASK_KINDS), text: TaskTextSchema, shared: z.boolean().default(false) }),
  z.object({ action: z.literal("edit"), id: z.string().min(1), text: TaskTextSchema }),
  z.object({ action: z.literal("share"), id: z.string().min(1), shared: z.boolean() }),
  z.object({ action: z.literal("done"), id: z.string().min(1), done: z.boolean() }),
  z.object({ action: z.literal("remove"), id: z.string().min(1) }),
]);
export type TaskAction = z.output<typeof TaskActionSchema>;

/** 担当者の操作（足す・書き直す・見せる／見せない・済み・消す） */
export function applyTaskAction(state: CaseState, a: TaskAction, at: number): CaseState {
  const tasks = state.familyTasks ?? [];
  const change = (id: string, f: (t: FamilyTask) => FamilyTask): CaseState => {
    if (!tasks.some((t) => t.id === id)) throw new Error("お願いが見つかりません");
    return { ...state, familyTasks: tasks.map((t) => (t.id === id ? f(t) : t)) };
  };
  switch (a.action) {
    case "add":
      return { ...state, familyTasks: [...tasks, { id: newId(), kind: a.kind, text: a.text, shared: a.shared, done: false, at }].slice(-MAX_TASKS) };
    case "edit":
      return change(a.id, (t) => ({ ...t, text: a.text }));
    case "share":
      return change(a.id, (t) => ({ ...t, shared: a.shared }));
    case "done":
      return change(a.id, (t) => ({ ...t, done: a.done }));
    case "remove":
      if (!tasks.some((t) => t.id === a.id)) throw new Error("お願いが見つかりません");
      return { ...state, familyTasks: tasks.filter((t) => t.id !== a.id) };
  }
}

/** ご家族が済んだ印を付ける（見せているものだけ） */
export function markDoneByFamily(state: CaseState, id: string, done: boolean): CaseState {
  const t = (state.familyTasks ?? []).find((x) => x.id === id && x.shared);
  if (!t) throw new Error("お願いが見つかりません");
  return applyTaskAction(state, { action: "done", id, done }, 0);
}

/** ご家族の窓口に出すもの */
export function sharedTasks(state: CaseState): FamilyTask[] {
  return (state.familyTasks ?? []).filter((t) => t.shared);
}
