import { describe, expect, test } from "vitest";
import { AUDIT_LIMIT, appendAudit, auditOfFarewell } from "./audit";
import { DEMO_CASE } from "./fixtures/demoCase";
import { allOptionFacts } from "./farewell";

describe("監査ログ", () => {
  test("足すたびに新しい状態を返し、元の状態は変えない", () => {
    const next = appendAudit(DEMO_CASE, { at: 1, actor: "staff", kind: "confirm", summary: "確定", refs: ["religion"] });
    expect(next.audit).toHaveLength(1);
    expect(DEMO_CASE.audit).toHaveLength(0);
  });

  test("上限を超えたら古いものから捨てる", () => {
    let s = DEMO_CASE;
    for (let i = 0; i < AUDIT_LIMIT + 5; i++) s = appendAudit(s, { at: i, actor: "ai", kind: "recommend", summary: "", refs: [] });
    expect(s.audit).toHaveLength(AUDIT_LIMIT);
    expect(s.audit[0]?.at).toBe(5);
  });

  test("推奨を出せなかったときは、止めた理由と「出さなかった」を残す", () => {
    const entries = auditOfFarewell({ ok: false, attempts: 2, violations: [{ rule: "fear_appeal", message: "あおった" }], facts: allOptionFacts() }, 9);
    expect(entries.map((e) => e.kind)).toEqual(["rejected_draft", "withheld"]);
    expect(entries[0]?.summary).toContain("fear_appeal");
  });
});
