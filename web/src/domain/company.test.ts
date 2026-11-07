import { describe, expect, it } from "vitest";
import { DEMO_COMPANY, company } from "./company";

describe("発注元の会社", () => {
  it("デモの案件は、環境変数があっても架空の会社にする", () => {
    expect(company("demo", { COMPANY_NAME: "本物の会社" })).toEqual(DEMO_COMPANY);
  });

  it("本番の案件は環境変数の会社。未設定なら空欄で、架空の会社名を出さない", () => {
    expect(company("live", { COMPANY_NAME: "自社", COMPANY_TEL: "1", COMPANY_FAX: "2" })).toEqual({ name: "自社", tel: "1", fax: "2" });
    expect(company("live", {})).toEqual({ name: "", tel: "", fax: "" });
  });
});
