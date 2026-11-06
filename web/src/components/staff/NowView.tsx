import { DECISIONS } from "../../domain/decisions";
import type { CaseState } from "../../engine/case";
import type { FarewellResult } from "../../engine/farewell";
import type { OversightAlert } from "../../engine/oversight";
import { PHASE_HINT, type PhaseReading } from "../../engine/phase";
import { DecisionRow } from "./DecisionBoard";
import { FeedbackButtons, type FeedbackHandler } from "./FeedbackButtons";
import c from "./console.module.css";
import s from "./staff.module.css";

interface NowViewProps {
  readonly state: CaseState;
  readonly phase: PhaseReading;
  readonly impacted: ReadonlySet<string>;
  readonly oversights: readonly OversightAlert[];
  readonly farewell: FarewellResult | null;
  readonly onConfirm: (decisionId: string, value: string) => void;
  readonly onFeedback: FeedbackHandler;
  /** お別れの仕方の推奨（FarewellPanel）。この画面の下半分に置く */
  readonly children: React.ReactNode;
}

/**
 * 「いま」：打合せの最中に担当者が見る 1 枚。
 * 今の段階と、次にすること（確定を待つ候補・見落とし・ご家族に尋ねること）を先に出し、推奨はその下に置く
 */
export function NowView({ state, phase, impacted, oversights, farewell, onConfirm, onFeedback, children }: NowViewProps) {
  const candidates = DECISIONS.filter((d) => state.decisions[d.id]?.status === "candidate" || impacted.has(d.id));
  const confirmed = DECISIONS.filter((d) => state.decisions[d.id]?.status === "confirmed");
  const questions = farewell?.ok ? farewell.recommendation.questionsToAsk : [];
  // 推奨が挙げた見落とし。決まりごとの検出と同じ項目は重ねて出さない
  const aiCautions = (farewell?.ok ? farewell.recommendation.cautions : []).filter((x) => !oversights.some((o) => o.decisionLabel === x.label));
  const alertCount = oversights.length + aiCautions.length;
  const nothingYet = candidates.length === 0 && alertCount === 0 && questions.length === 0;

  return (
    <div className={c.view}>
      <section className={c.hero} aria-labelledby="now-phase">
        <p className={c.heroEyebrow}>いま話していること</p>
        <h1 id="now-phase" className={c.heroTitle}>
          {phase.label}
        </h1>
        <p className={c.heroHint}>{PHASE_HINT[phase.phase]}</p>
        {confirmed.length > 0 && (
          <div className={c.decided} aria-label="決まったこと">
            <span className={c.decidedLabel}>決まったこと</span>
            {confirmed.map((d) => (
              <span key={d.id} className={c.decidedChip}>
                <b>{d.label}</b>
                {state.decisions[d.id]?.value}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className={c.next} aria-labelledby="next-title">
        <h2 id="next-title" className={c.sectionTitle}>
          次にすること
        </h2>
        {nothingYet && <p className={c.quiet}>会話が進むと、確かめること・確定を待つ候補・見落としがここに並びます。</p>}

        {alertCount > 0 && (
          <div className={c.lane} data-testid="oversights">
            <h3 className={c.laneTitle}>
              <span className={c.dotWarn} aria-hidden="true" />
              見落とし注意<span className={c.laneCount}>{alertCount}</span>
            </h3>
            {oversights.map((a) => (
              <article key={a.id} className={c.alert}>
                <h4>{a.decisionLabel}</h4>
                <p>{a.message}</p>
                <div className={s.meta2}>
                  {a.utteranceIds.length > 0 && (
                    <span className={s.tag}>きっかけ：「{state.utterances.find((u) => u.id === a.utteranceIds.at(-1))?.text.slice(0, 18)}…」</span>
                  )}
                  <FeedbackButtons state={state} target={`oversight:${a.id}`} onFeedback={onFeedback} />
                </div>
              </article>
            ))}
            {aiCautions.map((x) => (
              <article key={x.decisionId + x.message} className={c.alert}>
                <h4>{x.label}</h4>
                <p>{x.message}</p>
                <div className={s.meta2}>
                  <span className={s.tag}>推奨から</span>
                </div>
              </article>
            ))}
          </div>
        )}

        {candidates.length > 0 && (
          <div className={c.lane}>
            <h3 className={c.laneTitle}>
              <span className={c.dotAccent} aria-hidden="true" />
              確定を待つ候補<span className={c.laneCount}>{candidates.length}</span>
            </h3>
            {candidates.map((item) => (
              <DecisionRow key={item.id} item={item} state={state} impacted={impacted} onConfirm={onConfirm} />
            ))}
          </div>
        )}

        {questions.length > 0 && (
          <div className={c.lane}>
            <h3 className={c.laneTitle}>
              <span className={c.dotInk} aria-hidden="true" />
              ご家族に尋ねてみる<span className={c.laneCount}>{questions.length}</span>
            </h3>
            <ul className={c.questions}>
              {questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className={c.farewell} aria-labelledby="farewell-title">
        <h2 id="farewell-title" className={c.sectionTitle}>
          お別れの仕方
        </h2>
        {children}
      </section>
    </div>
  );
}
