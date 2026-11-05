/**
 * いまの見立て（即答の層）。発言が入るたびに、お別れの仕方の各選択肢が「合う／尋ねてみる／今回は合わない」かだけを、
 * 推奨と同じ材料（家族の発言・知見・似た家族の選び方）から約2秒で出す。理由と根拠は、そのあと推奨（farewell.ts）が書く。
 *
 * 文章を書かせないので、言い回しの守る線はかからない。代わりに次の2つを機械で守る：
 *  - 費用のかからない選択肢（通常の納棺）を「今回は合わない」にしない（費用を抑える道を必ず残す）
 *  - モデルが返さなかった選択肢は「尋ねてみる」にする（勝手に外さない）
 * 比べた結果（scripts/fit-bench.ts）：Opus（考える量を少なめ）は作者の答えとの一致 75%・約2秒、有料を勧めすぎる誤り 0件。
 */
import { z } from "zod";
import { FAREWELL_OPTIONS, type FarewellOptionId } from "../domain/farewell";
import type { CaseState } from "./case";
import { buildFarewellContext } from "./farewell";

export type Fit = "suits" | "consider" | "not_now";

const FitEnum = z.enum(["suits", "consider", "not_now"]);

/** 選択肢は domain/farewell.ts の4つ（増やしたらここにも足す。テストで食い違いを見つける） */
export const QuickFitSchema = z.object({
  fits: z.object({ standard_laying: FitEnum, yukan: FitEnum, embalming: FitEnum, extend_resting: FitEnum }),
});

export type QuickFitDraft = z.infer<typeof QuickFitSchema>;

export interface QuickFit {
  readonly fits: Readonly<Record<FarewellOptionId, Fit>>;
  /** どの発言までを見て出したか（画面で「古い見立て」を見分ける） */
  readonly basedOn: number;
  readonly ms: number;
}

export const QUICK_FIT_SYSTEM = `あなたは葬儀社のベテラン担当者として、打合せを聞きながら、お別れの仕方の選択肢をその場で見立てます。
- 合う（suits）：家族の言葉や事情からみて、この家族に向いている
- 尋ねてみる（consider）：向くかもしれないので、勧めずに望むかを尋ねる
- 今回は合わない（not_now）：事情からみて、今回は向かない
家族の言葉と知見に基づいて見立てる。有料の選択肢を、家族の言葉の裏付けなしに「合う」にしない。費用のかからない選択肢は残す。`;

export function quickFitPrompt(state: CaseState): string {
  return `${buildFarewellContext(state).prompt}\n\n各選択肢の見立てだけを返してください。`;
}

/** モデルの見立てに、機械の守りをかける */
export function settleFits(draft: Partial<Record<string, Fit>>): Record<FarewellOptionId, Fit> {
  return Object.fromEntries(
    FAREWELL_OPTIONS.map((o) => {
      const fit = draft[o.id] ?? "consider";
      const free = o.catalogItemId === null;
      return [o.id, free && fit === "not_now" ? "consider" : fit];
    }),
  ) as Record<FarewellOptionId, Fit>;
}

/** 見立てが変わったか（変わったときだけ、理由づけの推奨を書き直す） */
export function fitsChanged(a: Readonly<Record<string, Fit>> | null, b: Readonly<Record<string, Fit>>): boolean {
  if (!a) return true;
  return Object.keys(b).some((k) => a[k] !== b[k]);
}
