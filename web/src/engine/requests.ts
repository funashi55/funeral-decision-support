/**
 * 遺族の窓口から届く変更の希望・質問。
 * 窓口は受け付けるだけで、決定は変えない。変えるかどうかは担当者が家族と話して決める。
 */
import { getDecision } from "../domain/decisions";
import type { CaseState, FamilyRequest, RequestKind } from "./case";

export const REQUEST_TEXT_MAX = 500;
/** 1件の案件で受け付ける件数の上限（誤操作や連打で担当者の画面が埋まらないように） */
export const REQUEST_LIMIT = 50;

export interface NewRequest {
  readonly kind: RequestKind;
  readonly decisionId: string | null;
  readonly text: string;
  readonly sentAt: number;
}

export class RequestError extends Error {}

export function addFamilyRequest(state: CaseState, input: NewRequest): CaseState {
  const text = input.text.trim();
  if (text.length === 0) throw new RequestError("内容を入力してください");
  if (text.length > REQUEST_TEXT_MAX) throw new RequestError(`${REQUEST_TEXT_MAX}文字以内で入力してください`);
  if (state.requests.length >= REQUEST_LIMIT) throw new RequestError("送れる件数の上限に達しました。担当者に直接お声がけください");
  if (input.decisionId !== null) {
    try {
      getDecision(input.decisionId);
    } catch {
      throw new RequestError("該当する決定がありません");
    }
  }
  if (input.kind === "change" && input.decisionId === null) throw new RequestError("どの決定を変えたいかを選んでください");
  const request: FamilyRequest = {
    id: `Q${state.requests.length + 1}`,
    kind: input.kind,
    decisionId: input.decisionId,
    text,
    sentAt: input.sentAt,
    status: "open",
    staffReply: null,
  };
  return { ...state, requests: [...state.requests, request] };
}

/** 担当者が受け取ったことを返す。返事は遺族の窓口に表示される */
export function acknowledgeRequest(state: CaseState, requestId: string, staffReply: string | null): CaseState {
  if (!state.requests.some((r) => r.id === requestId)) throw new RequestError("該当する依頼がありません");
  const reply = staffReply?.trim() || null;
  return {
    ...state,
    requests: state.requests.map((r) => (r.id === requestId ? { ...r, status: "acknowledged", staffReply: reply } : r)),
  };
}
