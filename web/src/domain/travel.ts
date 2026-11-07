/**
 * 喪家（ご自宅）から自社の会館までの車の時間。
 * 住所 → 位置は国土地理院の住所検索、車の時間は OSRM（道路の地図から計算。渋滞は入らない目安）。
 * ここは外の応答を読み解く純粋な関数だけを置く（取りに行くのは server/travel.ts）。
 */
import { z } from "zod";

export interface LatLng {
  readonly lat: number;
  readonly lng: number;
}

export interface HallPin extends LatLng {
  readonly id: string;
  readonly name: string;
  readonly address: string;
  readonly phone?: string;
  /** 喪家からの車の時間（分）。住所が決まる前は無い */
  readonly minutes?: number;
  /** 喪家からの道のり（km） */
  readonly km?: number;
}

export interface TravelView {
  readonly home?: LatLng & { readonly address: string };
  readonly halls: readonly HallPin[];
  /** 住所が見つからなかった・時間を計れなかったときの一言 */
  readonly note?: string;
}

const GsiSchema = z.array(
  z.object({
    geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
    properties: z.object({ title: z.string() }).partial().optional(),
  }),
);

/** 国土地理院の住所検索の応答から、いちばん上の位置を取る */
export function parseGsi(json: unknown): LatLng | undefined {
  const r = GsiSchema.safeParse(json);
  const first = r.success ? r.data[0] : undefined;
  if (!first) return undefined;
  const [lng, lat] = first.geometry.coordinates;
  // 日本の外に出たものは取り違え
  if (lat < 20 || lat > 46 || lng < 122 || lng > 154) return undefined;
  return { lat, lng };
}

const OsrmTableSchema = z.object({
  code: z.literal("Ok"),
  durations: z.array(z.array(z.number().nullable())).min(1),
  distances: z.array(z.array(z.number().nullable())).optional(),
});

/** OSRM の表（出発は 1 か所）から、行き先ごとの分と km を取る。並びは行き先の順 */
export function parseOsrmTable(json: unknown, count: number): { minutes?: number; km?: number }[] {
  const r = OsrmTableSchema.safeParse(json);
  if (!r.success) return Array.from({ length: count }, () => ({}));
  const d = r.data.durations[0] ?? [];
  const m = r.data.distances?.[0] ?? [];
  // 表の 0 番目は出発地そのもの
  return Array.from({ length: count }, (_, i) => {
    const sec = d[i + 1];
    const meters = m[i + 1];
    return {
      minutes: typeof sec === "number" ? Math.max(1, Math.round(sec / 60)) : undefined,
      km: typeof meters === "number" ? Math.round(meters / 100) / 10 : undefined,
    };
  });
}

/** 近い順（時間の分からないものは後ろ、そのなかは名簿の順） */
export function byMinutes(halls: readonly HallPin[]): HallPin[] {
  return [...halls].sort((a, b) => (a.minutes ?? Infinity) - (b.minutes ?? Infinity));
}
