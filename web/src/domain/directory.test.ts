import { describe, expect, it } from "vitest";
import sample from "../data/directory.sample.json";
import { DirectorySchema, mapEmbedUrl, placesMentioned, routeEmbedUrl, routeLinkUrl, telHref } from "./directory";

const directory = DirectorySchema.parse(sample);

describe("関係先の名簿", () => {
  it("デモの名簿は架空で、番号はかからない形", () => {
    for (const p of directory) {
      expect(p.name).toMatch(/デモ/);
      expect(p.phone ?? "").toMatch(/^000-/);
    }
  });

  it("会話に出た呼び方（寺号だけ・別名）で見つける", () => {
    const found = placesMentioned(directory, ["東光寺さんにお願いしています", "火葬は11月11日の12時に市営斎場を押さえます"]);
    expect(found.map((p) => p.id)).toEqual(["demo-temple-1", "demo-crematorium"]);
  });

  it("名前が出ていなければ何も出さない", () => {
    expect(placesMentioned(directory, ["よろしくお願いします"])).toEqual([]);
  });

  it("地図・経路・電話の URL を作る（鍵がなくても使える）", () => {
    expect(mapEmbedUrl("東京都千代田区丸の内1丁目")).toMatch(/^https:\/\/maps\.google\.com\/maps\?q=.+output=embed$/);
    expect(mapEmbedUrl("住所", "K")).toMatch(/embed\/v1\/place\?key=K/);
    expect(routeEmbedUrl("A", "B")).toMatch(/saddr=A&daddr=B/);
    expect(routeLinkUrl("A", "B")).toBe("https://www.google.com/maps/dir/?api=1&origin=A&destination=B&travelmode=driving");
    expect(telHref("０１７-０００-１２３４")).toBe("tel:0170001234");
  });
});
