import { describe, expect, it } from "vitest";
import { parseCsv, placesFromCsv } from "./directory-import";

describe("名簿の取り込み（CSV）", () => {
  it("引用符の中のカンマ・改行を崩さない", () => {
    expect(parseCsv('名前,住所\n"架空寺","東京都, 1丁目"\n')).toEqual([
      ["名前", "住所"],
      ["架空寺", "東京都, 1丁目"],
    ]);
  });

  it("名前・宗派・住所・電話だけを取り、メモの列は持ってこない", () => {
    const csv = '﻿名前,住所,電話,宗派 1,情報\n架空寺,東京都千代田区,000-0000,"浄土宗 (https://www.notion.so/x)",作法のメモ\n,,,,\n';
    expect(placesFromCsv("temple", csv)).toEqual([{ id: "temple-1", kind: "temple", name: "架空寺", aliases: [], sect: "浄土宗", address: "東京都千代田区", phone: "000-0000" }]);
  });
});
