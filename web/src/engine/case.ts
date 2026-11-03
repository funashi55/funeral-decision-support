import type { FamilyProfile } from "../domain/similarFamilies";

export type Speaker = "staff" | "chief_mourner" | "family";

export interface Utterance {
  readonly id: string;
  readonly speaker: Speaker;
  readonly speakerLabel: string;
  readonly text: string;
  /** 打合せ開始からの経過（秒） */
  readonly at: number;
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
}
