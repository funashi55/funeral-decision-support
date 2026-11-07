import { describe, expect, it } from "vitest";
import { loadDirectory, saveDirectory } from "./directory";
import { createTestKv } from "./kv";

describe("関係先の名簿の読み出し", () => {
  it("デモの案件は架空の名簿だけを使い、本番の名簿を見せない", async () => {
    const kv = createTestKv();
    await saveDirectory([{ id: "t1", kind: "temple", name: "自社の名簿のお寺", aliases: [], phone: "1" }], kv);
    const demo = await loadDirectory("demo", kv);
    expect(demo.every((p) => p.name.includes("デモ"))).toBe(true);
    expect((await loadDirectory("live", kv)).map((p) => p.name)).toEqual(["自社の名簿のお寺"]);
  });

  it("本番の名簿がまだなければ空（架空の名簿を本番に出さない）", async () => {
    expect(await loadDirectory("live", createTestKv())).toEqual([]);
  });
});
