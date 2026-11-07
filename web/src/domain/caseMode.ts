/**
 * デモと本番の切り分け。案件の ID の頭で決まる（クライアントからも使うので、サーバー専用のものを読み込まない）
 * - デモ：共用デモの山田家（demo-yamada）と、試す人ごとに作るデモ（trial-）。架空のご家族。URL は /demo/<id>
 * - 本番：喪家の登録で作った案件（case-）。URL は /staff/<id>
 * 片方の URL でもう片方の案件は開けない（proxy.ts が振り分ける）
 */
export const DEMO_CASE_ID = "demo-yamada";
export const TRIAL_PREFIX = "trial-";
export const CASE_PREFIX = "case-";

export type CaseMode = "demo" | "live";

export function caseMode(caseId: string): CaseMode | undefined {
  if (caseId === DEMO_CASE_ID || caseId.startsWith(TRIAL_PREFIX)) return "demo";
  if (caseId.startsWith(CASE_PREFIX)) return "live";
  return undefined;
}

export const isDemoCase = (caseId: string): boolean => caseMode(caseId) === "demo";

/** その案件の画面の URL（打合せ・受注書・発注書・年回表） */
export function caseHref(caseId: string, sub = ""): string {
  const base = isDemoCase(caseId) ? "/demo" : "/staff";
  return `${base}/${encodeURIComponent(caseId)}${sub ? `/${sub}` : ""}`;
}

/** 案件の一覧（デモはデモの入口、本番は施行一覧） */
export const listHref = (caseId: string): string => (isDemoCase(caseId) ? "/demo" : "/staff");
