import type { CaseState } from "../engine/case";
import type { FarewellResult } from "../engine/farewell";
import type { FamilyView } from "../engine/familyView";

interface Envelope<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...init });
  const body = (await res.json()) as Envelope<T>;
  if (!body.success || body.data === undefined) throw new Error(body.error ?? "通信に失敗しました");
  return body.data;
}

const post = <T,>(path: string, body?: unknown): Promise<T> => call<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

export const api = {
  addUtterance: (caseId: string, u: { speaker: string; speakerLabel: string; text: string; at: number }) => post<CaseState>(`/api/cases/${caseId}/utterances`, u),
  extract: (caseId: string) => post<CaseState>(`/api/cases/${caseId}/extract`),
  farewell: (caseId: string) => post<FarewellResult>(`/api/cases/${caseId}/farewell`),
  confirm: (caseId: string, decisionId: string, value: string) => post<CaseState>(`/api/cases/${caseId}/decisions`, { decisionId, value }),
  reset: (caseId: string) => post<CaseState>(`/api/cases/${caseId}/reset`),
  acknowledge: (caseId: string, requestId: string, reply: string | null) => post<CaseState>(`/api/cases/${caseId}/requests/${requestId}`, { reply }),
  sendFamilyRequest: (token: string, body: { kind: "change" | "question"; decisionId: string | null; text: string }) =>
    post<FamilyView>(`/api/family/${encodeURIComponent(token)}/requests`, body),
};
