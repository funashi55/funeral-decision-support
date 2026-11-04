/** 推奨の評価と、ベテランの答えとの一致を数える */
import type { FarewellOptionId } from "../src/domain/farewell";
import type { Fit, JudgmentScene } from "./judgment-scenes";

export interface Agreement {
  readonly matched: number;
  readonly total: number;
  /** 一致しなかった選択肢（答え → 推奨） */
  readonly misses: readonly { readonly id: FarewellOptionId; readonly expected: Fit; readonly actual: Fit | "missing" }[];
}

export function agreementOf(scene: JudgmentScene, fits: ReadonlyMap<string, Fit>): Agreement {
  const entries = Object.entries(scene.answer) as [FarewellOptionId, Fit][];
  const misses = entries.flatMap(([id, expected]) => {
    const actual: Fit | "missing" = fits.get(id) ?? "missing";
    return actual === expected ? [] : [{ id, expected, actual }];
  });
  return { matched: entries.length - misses.length, total: entries.length, misses };
}

export function rate(list: readonly Agreement[]): number {
  const total = list.reduce((a, x) => a + x.total, 0);
  return total === 0 ? 0 : Math.round((list.reduce((a, x) => a + x.matched, 0) / total) * 1000) / 10;
}
