import Image from "next/image";
import { altarImageFor, paletteFor } from "../domain/altar";

interface AltarPreviewProps {
  /** 生花の色合いの決定の値 */
  readonly flowerColor: string | undefined;
  readonly className?: string;
  readonly captionClassName?: string;
}

/** 祭壇のイメージ。実際の祭壇を約束するものではないため、必ず「イメージ」と明記する */
export function AltarPreview({ flowerColor, className, captionClassName }: AltarPreviewProps) {
  const palette = paletteFor(flowerColor);
  const src = altarImageFor(palette.id);
  if (!src) return null;
  return (
    <figure className={className} data-testid="altar-preview">
      <Image src={src} alt={`祭壇のイメージ（生花：${palette.label}）`} width={1280} height={714} sizes="(max-width: 720px) 100vw, 560px" loading="lazy" />
      <figcaption className={captionClassName}>
        イメージ（サンプル）：生花の色合いを「{palette.label}」にした場合。実際の花の種類や配置は異なります
      </figcaption>
    </figure>
  );
}
