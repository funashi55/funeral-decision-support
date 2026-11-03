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

export interface CaseState {
  readonly caseId: string;
  readonly familyName: string;
  readonly profile: FamilyProfile;
  readonly utterances: readonly Utterance[];
  readonly circumstances: readonly FamilyCircumstance[];
  readonly decisions: Readonly<Record<string, DecisionState>>;
}
