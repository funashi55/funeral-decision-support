import type { FactCandidate, FactKey } from "./facts";
import type { Registration } from "./registration";
import type { FamilyProfile } from "../domain/similarFamilies";

export type Speaker = "staff" | "chief_mourner" | "family";

export interface Utterance {
  readonly id: string;
  readonly speaker: Speaker;
  readonly speakerLabel: string;
  readonly text: string;
  /** 打合せ開始からの経過（秒） */
  readonly at: number;
  /** 話した人をどう決めたか（rule・model・turn は自動、manual は担当者が直した）。ボタンで選んだ発言にはない */
  readonly speakerBy?: "rule" | "model" | "turn" | "manual";
}

export type DecisionStatus = "candidate" | "confirmed";

export interface DecisionState {
  readonly value: string;
  readonly status: DecisionStatus;
  /** 根拠になった発言 */
  readonly utteranceIds: readonly string[];
}

/** 打合せ中に拾った家族の事情（抽出結果） */
export interface FamilyCircumstance {
  readonly id: string;
  readonly text: string;
  readonly utteranceIds: readonly string[];
}

export type RequestKind = "change" | "question";
export type RequestStatus = "open" | "acknowledged";

/** 遺族の窓口から担当者へ届く、変更の希望や質問 */
export interface FamilyRequest {
  readonly id: string;
  readonly kind: RequestKind;
  /** どの決定についてか（決定に紐づかない質問は null） */
  readonly decisionId: string | null;
  readonly text: string;
  /** 送られた時刻（UNIX ミリ秒） */
  readonly sentAt: number;
  readonly status: RequestStatus;
  /** 担当者からの返事。遺族の窓口に表示する */
  readonly staffReply: string | null;
}

export type AuditKind =
  | "confirm" // 担当者が確定した
  | "recommend" // 推奨を出した（判定役を通った）
  | "withheld" // 守る線に2回落ちて推奨を出さなかった
  | "rejected_draft" // 1回目の案を止めた
  | "feedback" // 担当者が「伝えた／使わない」を記録した
  | "family_request" // 遺族の窓口から届いた
  | "request_reply" // 担当者が返事をした
  | "family_chat_handoff" // 窓口の対話が担当者に回した
  | "export" // 基幹システム向けに書き出した
  | "todo" // 担当者が自分でやることを足した・済ませた・消した
  | "register"; // 喪家を登録した

/** 監査ログ。誰が・いつ・何をしたかを残す（AI の判定の結果も含む） */
export interface AuditEntry {
  readonly at: number;
  readonly actor: "staff" | "ai" | "family";
  readonly kind: AuditKind;
  readonly summary: string;
  /** 関わる決定・選択肢・知見などの ID */
  readonly refs: readonly string[];
}

export type FeedbackVerdict = "told" | "unused";

/** 推奨の各要素を、担当者が家族に伝えたか・使わなかったか（知見の改善に使う） */
export interface Feedback {
  /** 例：farewell:yukan、oversight:obituary_unnotified */
  readonly target: string;
  readonly verdict: FeedbackVerdict;
  readonly at: number;
}

/** 遺族の窓口での、家族と案内役のやりとり（家族のもの。担当者の画面には担当者に回したものだけが届く） */
export interface ChatTurn {
  readonly id: string;
  readonly role: "family" | "assistant";
  readonly text: string;
  readonly at: number;
  /** この返事のときに担当者へ回したか */
  readonly handedOff: boolean;
}

/** 家族が窓口に残した検討メモ（家族が自分たちで考えるためのもの） */
export interface FamilyNote {
  readonly id: string;
  readonly text: string;
  readonly at: number;
}

/** 担当者が自分で足したやること（決めることの一覧にない用事） */
export interface CustomTodo {
  readonly id: string;
  readonly text: string;
  readonly done: boolean;
  readonly at: number;
}

export interface CaseState {
  readonly caseId: string;
  readonly familyName: string;
  readonly profile: FamilyProfile;
  readonly utterances: readonly Utterance[];
  readonly circumstances: readonly FamilyCircumstance[];
  readonly decisions: Readonly<Record<string, DecisionState>>;
  readonly requests: readonly FamilyRequest[];
  /** 遺族の窓口を開くための合言葉（共有リンクに含める） */
  readonly familyToken: string;
  /** 遺族の窓口を止めたか（共有リンクの失効） */
  readonly familyLinkRevoked: boolean;
  readonly feedback: readonly Feedback[];
  readonly familyChat: readonly ChatTurn[];
  readonly familyNotes: readonly FamilyNote[];
  readonly audit: readonly AuditEntry[];
  /** 担当者が自分で足したやること（前から保存されている案件にはないことがある） */
  readonly customTodos?: readonly CustomTodo[];
  /** 喪家の登録で受付が入れた内容（デモ・試用の案件にはない）。家名のほかは空でもよく、確定した事実があとから入る */
  readonly registration?: Registration;
  /** 会話から拾った受付の事実の候補（故人のお名前など）。担当者が確定すると registration に移る */
  readonly factCandidates?: Readonly<Partial<Record<FactKey, FactCandidate>>>;
}
