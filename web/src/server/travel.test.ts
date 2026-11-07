import { describe, expect, it, vi } from "vitest";
import type { Place } from "../domain/directory";
import { createTestKv } from "./kv";
import { travelView, type Fetcher } from "./travel";

const halls: Place[] = [
  { id: "h1", kind: "hall", name: "東会館", aliases: [], address: "架空県東町1" },
  { id: "h2", kind: "hall", name: "西会館", aliases: [], address: "架空県西町2" },
  { id: "t1", kind: "temple", name: "架空寺", aliases: [], address: "架空県寺町3" },
];
const POS: Record<string, [number, number]> = { 架空県東町1: [140.7, 40.8], 架空県西町2: [140.6, 40.7], 架空県自宅町9: [140.65, 40.75] };

function fakeFetch(): Fetcher & ReturnType<typeof vi.fn> {
  return vi.fn(async (url: string) => {
    if (url.includes("AddressSearch")) {
      const q = decodeURIComponent(url.split("q=")[1] ?? "");
      const c = POS[q];
      return Response.json(c ? [{ geometry: { coordinates: c }, properties: { title: q } }] : []);
    }
    return Response.json({ code: "Ok", durations: [[0, 1800, 600]], distances: [[0, 20000, 5000]] });
  }) as never;
}

describe("会館のピンと車の時間", () => {
  it("住所が決まる前は、会館のピンだけ（お寺は入れない）", async () => {
    const v = await travelView(halls, undefined, createTestKv(), fakeFetch());
    expect(v.home).toBeUndefined();
    expect(v.halls.map((h) => h.id)).toEqual(["h1", "h2"]);
    expect(v.halls[0]?.minutes).toBeUndefined();
  });

  it("住所が決まると、各会館までの時間を近い順に付ける", async () => {
    const v = await travelView(halls, "架空県自宅町9", createTestKv(), fakeFetch());
    expect(v.home).toMatchObject({ lat: 40.75, lng: 140.65 });
    expect(v.halls.map((h) => [h.id, h.minutes, h.km])).toEqual([
      ["h2", 10, 5],
      ["h1", 30, 20],
    ]);
  });

  it("会館の位置は保存場所に置き、2回目は聞かない。ご自宅の住所は置かない", async () => {
    const kv = createTestKv();
    await travelView(halls, "架空県自宅町9", kv, fakeFetch());
    const second = fakeFetch();
    await travelView(halls, undefined, kv, second);
    expect(second).not.toHaveBeenCalled();
    expect(await kv.get("v1:geo:架空県自宅町9")).toBeUndefined();
  });

  it("ご自宅の住所が見つからないときは、ピンと一言を返す", async () => {
    const v = await travelView(halls, "どこにもない住所", createTestKv(), fakeFetch());
    expect(v.home).toBeUndefined();
    expect(v.note).toContain("見つけられません");
    expect(v.halls).toHaveLength(2);
  });
});
