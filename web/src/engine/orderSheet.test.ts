import { describe, expect, it } from "vitest";
import type { CaseState } from "./case";
import { DEMO_CASE } from "./fixtures/demoCase";
import { OrderSheetError, buildOrderSheet } from "./orderSheet";

const state = (decisions: CaseState["decisions"] = {}): CaseState => ({ ...DEMO_CASE, decisions });
const done = (value: string) => ({ value, status: "confirmed" as const, utteranceIds: [] });

describe("発注書を1枚ずつ作る", () => {
  it("確定した数をそのまま数量に書き、送れる状態にする前提がそろえば ready になる", () => {
    const { sheet } = buildOrderSheet(state({ return_gifts: done("80個") }), "return_gifts");
    expect(sheet.status).toBe("ready");
    expect(sheet.items[0]?.quantity).toBe("80個");
    expect(sheet.vendor).toBe("返礼品店");
  });

  it("前提が確定していなければ下書き（確定待ち）として作り、わからない欄は要確認にする", () => {
    const { sheet } = buildOrderSheet(state(), "return_gifts");
    expect(sheet.status).toBe("waiting");
    expect(sheet.items[0]?.quantity).toBe("要確認");
    expect(sheet.blanks).toBeGreaterThan(0);
  });

  it("電話で済む手配や、要らない手配は発注書にしない", () => {
    expect(() => buildOrderSheet(state(), "temple_contact")).toThrow(OrderSheetError);
    expect(() => buildOrderSheet(state({ meals: done("なし") }), "meals")).toThrow(OrderSheetError);
  });

  it("金額は書かない", () => {
    const { sheet } = buildOrderSheet(state({ return_gifts: done("80個") }), "return_gifts");
    expect(JSON.stringify(sheet)).not.toMatch(/円/);
  });
});
