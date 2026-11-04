/**
 * 祭壇イメージ（限定版）。標準の祭壇1種のイメージを、生花の色合いだけ変えたもの。
 * イメージは画像モデルで事前に編集し、Opus が検品して合格したものだけを出す（scripts/altar-check.ts）。
 * 実際の祭壇の見え方を約束するものではないため、画面には必ず「イメージ」と明記する。
 */
import manifest from "../data/altar-images.json";

export interface AltarPalette {
  readonly id: string;
  readonly label: string;
  /** 生花の色合いの決定の値に、この言葉が含まれていたら選ぶ */
  readonly cues: readonly RegExp[];
}

export const ALTAR_PALETTES: readonly AltarPalette[] = [
  { id: "white", label: "白を基調に", cues: [/白/] },
  { id: "pink", label: "淡いピンクと白", cues: [/ピンク|桃|桜/] },
  { id: "purple", label: "やさしい紫と白", cues: [/紫|ラベンダー|藤/] },
  { id: "yellow", label: "やわらかな黄色と白", cues: [/黄|クリーム|オレンジ|ひまわり/] },
  { id: "blue", label: "淡い青と白", cues: [/青|水色|ブルー/] },
];

interface CheckedImage {
  readonly id: string;
  readonly passed: boolean;
}

/** 生花の色合いの決定（候補を含む）から色合いを選ぶ。当てはまらなければ白 */
export function paletteFor(flowerColor: string | undefined): AltarPalette {
  const fallback = ALTAR_PALETTES[0]!;
  if (!flowerColor) return fallback;
  return ALTAR_PALETTES.find((p) => p.id !== "white" && p.cues.some((c) => c.test(flowerColor))) ?? fallback;
}

/** 検品に合格したイメージだけを返す。合格していなければ null（画面に出さない） */
export function altarImageFor(paletteId: string, checked: readonly CheckedImage[] = manifest.images): string | null {
  const ok = checked.find((c) => c.id === paletteId)?.passed ?? false;
  return ok ? `/altar/${paletteId}.webp` : null;
}
