"use client";
import { useState } from "react";
import { PHASE_LABEL, type Phase } from "../../domain/decisions";
import { yen, type Range } from "../../domain/pricing";
import type { CaseState } from "../../engine/case";
import { allowsPrices } from "../../engine/phase";
import type { PlanFitProposal } from "../../engine/planFit";
import { buildPlanProposals } from "../../engine/plans";
import { AltarPreview } from "../AltarPreview";
import { FeedbackButtons, type FeedbackHandler } from "./FeedbackButtons";
import s from "./staff.module.css";

interface PlansPanelProps {
  readonly state: CaseState;
  readonly phase: Phase;
  /** この家族に合うところ・確かめたいこと（プランの見立て） */
  readonly planFit: PlanFitProposal | null;
  readonly onFeedback: FeedbackHandler;
}

/** 3つの幅の案。金額はすべて価格表から計算し、含まれないものを先に見せる */
export function PlansPanel({ state, phase, planFit, onFeedback }: PlansPanelProps) {
  const [showAnyway, setShowAnyway] = useState(false);
  if (!allowsPrices(phase) && !showAnyway) {
    return (
      <div className={s.scroll}>
        <p className={s.empty}>
          いまは「{PHASE_LABEL[phase]}」の話をしています。費用の話は、ご家族の気持ちとお別れの仕方を伺ってからにします。
        </p>
        <button type="button" className={s.btn} onClick={() => setShowAnyway(true)}>
          それでも案を見る（担当者の準備用）
        </button>
      </div>
    );
  }
  const proposals = buildPlanProposals(state);
  return (
    <div className={s.scroll}>
      <AltarPreview flowerColor={state.decisions.flower_color?.value} className={s.altar} captionClassName={s.count} />
      <p className={s.empty}>価格の上下ではなく、ご家族の気持ちの幅として並べています。費用を抑える案から順に示します。</p>
      {proposals.map((p) => (
        <article key={p.range} className={s.option} data-testid={`plan-${p.range}`}>
          <div className={s.optionHead}>
            <h3>
              <span className={`${s.fit} ${s.fitConsider}`}>{p.rangeLabel}</span>
              {p.planLabel}
              {planFit?.bestRange === p.range && <span className={`${s.fit} ${s.fitSuits}`}>この家族に合いそう</span>}
            </h3>
            <span className={s.price}>{yen(p.estimate.total)}</span>
          </div>
          <PlanFitNote planFit={planFit} range={p.range} />
          <div className={s.can}>
            <div>
              <b>プランに含まれるもの</b>
              <ul>
                {p.includes.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
            <div>
              <b>含まれないもの（必要なら追加）</b>
              <ul>
                {p.estimate.notIncluded.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          </div>
          <details className={s.evidence}>
            <summary>見積もりの明細</summary>
            <table className={s.lines}>
              <tbody>
                {p.estimate.lines.map((l) => (
                  <tr key={l.label}>
                    <th scope="row">
                      {l.label}
                      {l.returnable && <span className={s.tag}>返品できる</span>}
                    </th>
                    <td>{l.quantity > 1 ? `${yen(l.unitPrice)} × ${l.quantity}` : ""}</td>
                    <td>{yen(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
          {p.additions.length > 0 && (
            <details className={s.evidence}>
              <summary>見積もりに足した理由</summary>
              <ul>
                {p.additions.map((a) => (
                  <li key={a.label}>
                    {a.label}：{a.why}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className={s.meta2}>
            {p.pendingCounts.map((x) => (
              <span key={x} className={`${s.tag} ${s.tagWarn}`}>
                {x}
              </span>
            ))}
            <FeedbackButtons state={state} target={`plan:${p.range}`} onFeedback={onFeedback} />
          </div>
        </article>
      ))}
      <p className={s.empty}>お布施は葬儀社の見積もりに含まれません。金額は架空の価格表によるものです。</p>
    </div>
  );
}

/** 幅ごとの、この家族に合うところ・確かめたいこと。いちばん合いそうな幅には切り出し方も添える */
function PlanFitNote({ planFit, range }: { readonly planFit: PlanFitProposal | null; readonly range: Range }) {
  const fit = planFit?.ranges.find((r) => r.range === range);
  if (!planFit || !fit) return null;
  return (
    <p className={s.reason}>
      {fit.fitsBecause && <span style={{ display: "block" }}>合うところ：{fit.fitsBecause}</span>}
      {fit.watchOut && <span style={{ display: "block" }}>確かめたいこと：{fit.watchOut}</span>}
      {planFit.bestRange === range && <span style={{ display: "block" }}>こう切り出しましょう：「{planFit.howToRaise}」</span>}
    </p>
  );
}
