import type { CaseState } from "../engine/case";
import type { FarewellResult } from "../engine/farewell";
import type { FamilyView } from "../engine/familyView";
import type { Paperwork } from "../engine/paperwork";
import type { OrderSheetMap } from "../server/orderSheetStore";
import type { SavedRecommendations } from "../server/recommendationStore";
import type { PlanFitResult } from "../engine/planFit";
import type { QuickFit } from "../engine/quickFit";
import type { FactKey } from "../engine/facts";
import type { Place } from "../domain/directory";

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
  me: () => call<{ email: string; name: string } | null>("/api/auth/me").catch(() => null),
  addUtterance: (caseId: string, u: { speaker: string; speakerLabel?: string; text: string; at: number }) => post<CaseState>(`/api/cases/${caseId}/utterances`, u),
  extract: (caseId: string) => post<CaseState>(`/api/cases/${caseId}/extract`),
  farewell: (caseId: string) => post<FarewellResult & { basedOn?: number }>(`/api/cases/${caseId}/farewell`),
  recommendations: (caseId: string) => call<SavedRecommendations>(`/api/cases/${caseId}/recommendations`),
  planFit: (caseId: string) => post<PlanFitResult & { basedOn?: number }>(`/api/cases/${caseId}/plan-fit`),
  quickFit: (caseId: string) => post<QuickFit>(`/api/cases/${caseId}/quick-fit`),
  /** 関係先の名簿（デモは架空、本番は自社の名簿） */
  directory: (caseId: string) => call<Place[]>(`/api/cases/${caseId}/directory`),
  paperwork: (caseId: string) => call<Paperwork | null>(`/api/cases/${caseId}/paperwork`),
  makePaperwork: (caseId: string) => post<Paperwork>(`/api/cases/${caseId}/paperwork`),
  orderSheets: (caseId: string) => call<OrderSheetMap>(`/api/cases/${caseId}/order-sheets`),
  makeOrderSheet: (caseId: string, orderId: string) => post<OrderSheetMap>(`/api/cases/${caseId}/order-sheets`, { orderId }),
  confirm: (caseId: string, decisionId: string, value: string) => post<CaseState>(`/api/cases/${caseId}/decisions`, { decisionId, value }),
  /** 受付の事実（故人のお名前など）を確定・書き直す */
  confirmFact: (caseId: string, key: FactKey, value: string) => post<CaseState>(`/api/cases/${caseId}/facts`, { key, value }),
  todo: (caseId: string, body: { action: "add"; text: string } | { action: "done"; id: string; done: boolean } | { action: "remove"; id: string }) =>
    post<CaseState>(`/api/cases/${caseId}/todos`, body),
  reset: (caseId: string) => post<CaseState>(`/api/cases/${caseId}/reset`),
  acknowledge: (caseId: string, requestId: string, reply: string | null) => post<CaseState>(`/api/cases/${caseId}/requests/${requestId}`, { reply }),
  swapSpeaker: (caseId: string, utteranceId: string, speaker: "staff" | "family") =>
    call<CaseState>(`/api/cases/${caseId}/utterances/${utteranceId}`, { method: "PATCH", body: JSON.stringify({ speaker }) }),
  editUtterance: (caseId: string, utteranceId: string, text: string) =>
    call<CaseState>(`/api/cases/${caseId}/utterances/${utteranceId}`, { method: "PATCH", body: JSON.stringify({ text }) }),
  feedback: (caseId: string, target: string, verdict: "told" | "unused" | "clear") => post<CaseState>(`/api/cases/${caseId}/feedback`, { target, verdict }),
  familyLink: (caseId: string, action: "revoke" | "reissue") => post<CaseState>(`/api/cases/${caseId}/family-link`, { action }),
  familyChat: (token: string, text: string) => post<FamilyView>(`/api/family/${encodeURIComponent(token)}/chat`, { text }),
  sendFamilyRequest: (token: string, body: { kind: "change" | "question"; decisionId: string | null; text: string }) =>
    post<FamilyView>(`/api/family/${encodeURIComponent(token)}/requests`, body),
};
