import { describe, expect, it } from "vitest";
import { caseHref, caseMode, listHref } from "../domain/caseMode";
import { modeRoute } from "./modeRoute";

describe("デモと本番の切り分け", () => {
  it("案件の ID の頭でデモか本番かが決まる", () => {
    expect(caseMode("demo-yamada")).toBe("demo");
    expect(caseMode("trial-abc")).toBe("demo");
    expect(caseMode("case-abc")).toBe("live");
    expect(caseMode("new")).toBeUndefined();
  });

  it("画面の URL は、デモは /demo、本番は /staff", () => {
    expect(caseHref("demo-yamada")).toBe("/demo/demo-yamada");
    expect(caseHref("trial-x", "juchu")).toBe("/demo/trial-x/juchu");
    expect(caseHref("case-x", "paperwork")).toBe("/staff/case-x/paperwork");
    expect(listHref("trial-x")).toBe("/demo");
    expect(listHref("case-x")).toBe("/staff");
  });

  it("デモの案件は /staff では開けず、/demo へ移る", () => {
    expect(modeRoute("/staff/demo-yamada")).toEqual({ kind: "redirect", path: "/demo/demo-yamada" });
    expect(modeRoute("/staff/trial-x/juchu")).toEqual({ kind: "redirect", path: "/demo/trial-x/juchu" });
  });

  it("/demo のデモの案件は、同じ画面で出す", () => {
    expect(modeRoute("/demo/demo-yamada/nenkai")).toEqual({ kind: "rewrite", path: "/staff/demo-yamada/nenkai" });
  });

  it("本番の案件は /demo では開けず、知らない ID は見つからない", () => {
    expect(modeRoute("/demo/case-x")).toEqual({ kind: "redirect", path: "/staff/case-x" });
    expect(modeRoute("/demo/whatever")).toEqual({ kind: "notFound" });
  });

  it("本番の案件・登録・一覧はそのまま通す", () => {
    expect(modeRoute("/staff/case-x")).toBeUndefined();
    expect(modeRoute("/staff/new")).toBeUndefined();
    expect(modeRoute("/staff")).toBeUndefined();
    expect(modeRoute("/demo")).toBeUndefined();
  });
});
