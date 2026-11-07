import { describe, expect, it } from "vitest";
import { byMinutes, parseGsi, parseOsrmTable, type HallPin } from "./travel";

describe("住所 → 位置（国土地理院）", () => {
  it("いちばん上の候補の緯度・経度を取る", () => {
    const json = [{ geometry: { coordinates: [139.775345, 35.682903], type: "Point" }, type: "Feature", properties: { title: "東京都中央区日本橋一丁目" } }];
    expect(parseGsi(json)).toEqual({ lat: 35.682903, lng: 139.775345 });
  });
  it("見つからない・形が違う・日本の外は位置なし", () => {
    expect(parseGsi([])).toBeUndefined();
    expect(parseGsi({ error: "x" })).toBeUndefined();
    expect(parseGsi([{ geometry: { coordinates: [0, 0] } }])).toBeUndefined();
  });
});

describe("車の時間（OSRM の表）", () => {
  it("出発地の列を飛ばして、行き先ごとの分と km にする", () => {
    const json = { code: "Ok", durations: [[0, 610, 1500]], distances: [[0, 4321, 15040]] };
    expect(parseOsrmTable(json, 2)).toEqual([
      { minutes: 10, km: 4.3 },
      { minutes: 25, km: 15 },
    ]);
  });
  it("道がない行き先・失敗した応答は時間なし", () => {
    expect(parseOsrmTable({ code: "Ok", durations: [[0, null]] }, 1)).toEqual([{ minutes: undefined, km: undefined }]);
    expect(parseOsrmTable({ code: "NoRoute" }, 2)).toEqual([{}, {}]);
  });
});

describe("近い順", () => {
  it("時間の短い順、分からないものは後ろ", () => {
    const h = (id: string, minutes?: number): HallPin => ({ id, name: id, address: "", lat: 0, lng: 0, minutes });
    expect(byMinutes([h("a"), h("b", 20), h("c", 5)]).map((x) => x.id)).toEqual(["c", "b", "a"]);
  });
});
