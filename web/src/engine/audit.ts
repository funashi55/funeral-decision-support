/**
 * 監査ログに1件足す。ログは増える一方で、書き換えない。
 * 件数が増えすぎないよう、古いものから捨てる。
 */
import type { AuditEntry, CaseState } from "./case";
import type { FarewellResult } from "./farewell";

export const AUDIT_LIMIT = 500;

export function appendAudit(state: CaseState, entry: AuditEntry): CaseState {
  const audit = [...state.audit, entry];
  return { ...state, audit: audit.length > AUDIT_LIMIT ? audit.slice(audit.length - AUDIT_LIMIT) : audit };
}

export function appendAudits(state: CaseState, entries: readonly AuditEntry[]): CaseState {
  return entries.reduce(appendAudit, state);
}

/** 判定役の結果を監査ログに残す。止めた理由も残し、後から見直せるようにする */
export function auditOfFarewell(result: FarewellResult, at: number): AuditEntry[] {
  const rejected = result.ok ? result.rejected : result.violations;
  const entries: AuditEntry[] = rejected.map((v) => ({ at, actor: "ai", kind: "rejected_draft", summary: `案を止めた（${v.rule}）：${v.message}`, refs: ["farewell"] }));
  if (result.ok) {
    const refs = result.recommendation.options.map((o) => `farewell:${o.id}`);
    return [...entries, { at, actor: "ai", kind: "recommend", summary: `お別れの仕方の推奨を出した（試行 ${result.attempts} 回）`, refs }];
  }
  return [...entries, { at, actor: "ai", kind: "withheld", summary: "守る線に2回落ちたため推奨を出さず、選択肢の事実だけを示した", refs: ["farewell"] }];
}

