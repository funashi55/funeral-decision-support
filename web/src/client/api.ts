import type { CaseState } from "../engine/case";
import type { FarewellResult } from "../engine/farewell";
import type { FamilyView } from "../engine/familyView";
import type { Paperwork } from "../engine/paperwork";
import type { PlanFitResult } from "../engine/planFit";
import type { QuickFit } from "../engine/quickFit";

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
  farewell: (caseId: string) => post<FarewellResult & { basedOn?: number }>(`/api/cases/${caseId}/farewell`),
  planFit: (caseId: string) => post<PlanFitResult & { basedOn?: number }>(`/api/cases/${caseId}/plan-fit`),
  quickFit: (caseId: string) => post<QuickFit>(`/api/cases/${caseId}/quick-fit`),
  paperwork: (caseId: string) => call<Paperwork | null>(`/api/cases/${caseId}/paperwork`),
  makePaperwork: (caseId: string) => post<Paperwork>(`/api/cases/${caseId}/paperwork`),
  confirm: (caseId: string, decisionId: string, value: string) => post<CaseState>(`/api/cases/${caseId}/decisions`, { decisionId, value }),
  reset: (caseId: string) => post<CaseState>(`/api/cases/${caseId}/reset`),
  acknowledge: (caseId: string, requestId: string, reply: string | null) => post<CaseState>(`/api/cases/${caseId}/requests/${requestId}`, { reply }),
  editUtterance: (caseId: string, utteranceId: string, text: string) =>
    call<CaseState>(`/api/cases/${caseId}/utterances/${utteranceId}`, { method: "PATCH", body: JSON.stringify({ text }) }),
  feedback: (caseId: string, target: string, verdict: "told" | "unused") => post<CaseState>(`/api/cases/${caseId}/feedback`, { target, verdict }),
  familyLink: (caseId: string, action: "revoke" | "reissue") => post<CaseState>(`/api/cases/${caseId}/family-link`, { action }),
  familyChat: (token: string, text: string) => post<FamilyView>(`/api/family/${encodeURIComponent(token)}/chat`, { text }),
  sendFamilyRequest: (token: string, body: { kind: "change" | "question"; decisionId: string | null; text: string }) =>
    post<FamilyView>(`/api/family/${encodeURIComponent(token)}/requests`, body),
};
