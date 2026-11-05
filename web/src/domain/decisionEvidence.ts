/**
 * 決めることボードに添える「実績」と「知見」。
 * 実績は基幹システムの施行の記録の匿名集計（scripts/build_decision_evidence.py が作る）。数字はここから出し、モデルには作らせない。
 * 似た家族の選び方は参考であり、合わせるよう促すものではない。
 */
import raw from "../data/decision-evidence.json";
import { loadKnowledge, rulesFor, withRecordRules, type Rule } from "../knowledge/rules";

export interface DecisionEvidence {
  readonly text: string;
  readonly count: number;
}

const EVIDENCE: Readonly<Record<string, DecisionEvidence>> = raw.evidence;
const KNOWLEDGE = withRecordRules(loadKnowledge());

export const EVIDENCE_SOURCE = raw.source;

export function evidenceFor(decisionId: string): DecisionEvidence | undefined {
  return EVIDENCE[decisionId];
}

/** その項目に関わる知見。その項目を主な対象（decisionIds の先頭）にした知見を先に並べる（ボードには最初の1つを出す） */
export function tipsFor(decisionId: string): Rule[] {
  const rules = rulesFor(KNOWLEDGE, [decisionId]);
  return [...rules.filter((r) => r.decisionIds[0] === decisionId), ...rules.filter((r) => r.decisionIds[0] !== decisionId)];
}
