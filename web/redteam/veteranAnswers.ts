/**
 * /veteran で集めた答えを、判断の場面の答えに差し替える。
 * 同じ人が何度か送ったときは、最後に送ったものを使う。
 * 4つの選択肢すべてに答えた場面だけを差し替え、ほかは作者の仮の答えのまま残す。
 */
import { FAREWELL_OPTIONS, type FarewellOptionId } from "../src/domain/farewell";
import type { Fit, JudgmentScene } from "../src/data/judgmentScenes";

export interface Submission {
  readonly respondent: string;
  readonly at: number;
  readonly scenes: Partial<Record<string, { readonly fits: Partial<Record<FarewellOptionId, Fit>>; readonly reason?: string }>>;
}

export function latestByRespondent(submissions: readonly Submission[]): Submission[] {
  const latest = new Map<string, Submission>();
  for (const s of submissions) {
    const prev = latest.get(s.respondent);
    if (!prev || s.at >= prev.at) latest.set(s.respondent, s);
  }
  return [...latest.values()].sort((a, b) => a.at - b.at);
}

/** 使う答えを1人分選ぶ。名前を指定しなければ、最後に送った人 */
export function pickSubmission(submissions: readonly Submission[], respondent?: string): Submission | undefined {
  const latest = latestByRespondent(submissions);
  return respondent ? latest.find((s) => s.respondent === respondent) : latest.at(-1);
}

export function applyVeteranAnswers(scenes: readonly JudgmentScene[], submission: Submission | undefined): JudgmentScene[] {
  if (!submission) return [...scenes];
  return scenes.map((scene) => {
    const fits = submission.scenes[scene.id]?.fits;
    const complete = fits && FAREWELL_OPTIONS.every((o) => fits[o.id] !== undefined);
    return complete ? { ...scene, answer: { ...fits }, answeredBy: "veteran" as const } : scene;
  });
}
