/**
 * 会館のピンと、喪家（ご自宅）から各会館までの車の時間を作る。
 * - 位置：国土地理院の住所検索（鍵は要らない）。会館の位置は保存場所に1年置き、毎回は聞かない
 * - 時間：OSRM の表（1回の問い合わせで全会館ぶん）。渋滞を入れない目安
 * ご自宅の住所は位置を聞くときだけ外へ送り、保存場所には置かない。
 */
import type { Place } from "../domain/directory";
import { byMinutes, parseGsi, parseOsrmTable, type HallPin, type LatLng, type TravelView } from "../domain/travel";
import { getKv, type Kv } from "./kv";

const GSI_URL = "https://msearch.gsi.go.jp/address-search/AddressSearch?q=";
const OSRM_URL = "https://router.project-osrm.org/table/v1/driving/";
const TIMEOUT_MS = 6000;
const GEO_TTL_SECONDS = 60 * 60 * 24 * 365;

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

async function getJson(fetcher: Fetcher, url: string): Promise<unknown> {
  const res = await fetcher(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`外の地図サービスが ${res.status} を返しました`);
  return res.json();
}

/** 住所 → 位置。見つからない・つながらないときは undefined */
export async function geocode(address: string, fetcher: Fetcher = fetch): Promise<LatLng | undefined> {
  try {
    return parseGsi(await getJson(fetcher, GSI_URL + encodeURIComponent(address)));
  } catch {
    return undefined;
  }
}

/** 会館の位置（保存場所に置いた位置を使い、なければ聞いて置く） */
async function hallPins(halls: readonly Place[], kv: Kv, fetcher: Fetcher): Promise<HallPin[]> {
  const pins = await Promise.all(
    halls.map(async (h): Promise<HallPin | undefined> => {
      if (!h.address) return undefined;
      const key = `v1:geo:${h.address}`;
      const saved = await kv.get<LatLng>(key);
      const at = saved ?? (await geocode(h.address, fetcher));
      if (!at) return undefined;
      if (!saved) await kv.set(key, at, GEO_TTL_SECONDS);
      return { id: h.id, name: h.name, address: h.address, phone: h.phone, lat: at.lat, lng: at.lng };
    }),
  );
  return pins.filter((p): p is HallPin => p !== undefined);
}

/** 出発地から各ピンまでの車の時間を付ける */
async function withDriveTimes(from: LatLng, pins: readonly HallPin[], fetcher: Fetcher): Promise<HallPin[] | undefined> {
  if (pins.length === 0) return [];
  const coords = [from, ...pins].map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(";");
  try {
    const times = parseOsrmTable(await getJson(fetcher, `${OSRM_URL}${coords}?sources=0&annotations=duration,distance`), pins.length);
    if (times.every((t) => t.minutes === undefined)) return undefined;
    return byMinutes(pins.map((p, i) => ({ ...p, ...times[i] })));
  } catch {
    return undefined;
  }
}

/** 会館のピンと、ご自宅の住所があれば各会館までの車の時間 */
export async function travelView(directory: readonly Place[], homeAddress: string | undefined, kv: Kv = getKv(), fetcher: Fetcher = fetch): Promise<TravelView> {
  const halls = await hallPins(
    directory.filter((p) => p.kind === "hall"),
    kv,
    fetcher,
  );
  if (!homeAddress) return { halls };
  const home = await geocode(homeAddress, fetcher);
  if (!home) return { halls, note: "ご自宅の住所から場所を見つけられませんでした。番地まで入っているか確かめてください。" };
  const timed = await withDriveTimes(home, halls, fetcher);
  return timed
    ? { home: { ...home, address: homeAddress }, halls: timed }
    : { home: { ...home, address: homeAddress }, halls, note: "車の時間を計れませんでした（地図のサービスにつながりません）。" };
}
