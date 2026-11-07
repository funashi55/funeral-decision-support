import { RANGE_LABEL, yen } from "../../domain/pricing";
import type { CaseState } from "../../engine/case";
import type { PlanFitProposal } from "../../engine/planFit";
import { buildPlanProposals } from "../../engine/plans";
import c from "./console.module.css";

/**
 * プランの見立て：いちばん合いそうな幅を、ご家族の言葉に結びつけた切り出し方と一緒に示す。
 * 費用を抑える工夫と、決めるのはご家族だと伝える問いを必ず添える。金額は価格表から出す
 */
export function PlanFitCard({ state, proposal, actions }: { readonly state: CaseState; readonly proposal: PlanFitProposal; readonly actions?: React.ReactNode }) {
  const plans = buildPlanProposals(state);
  const best = plans.find((p) => p.range === proposal.bestRange);
  const quote = (ids: readonly string[]): string | undefined => state.utterances.find((u) => u.id === ids.at(-1))?.text;
  return (
    <article className={c.planFit} data-testid="plan-fit">
      <div className={c.proposalHead}>
        <b>プラン</b>
        <span className={c.fitSuits}>{RANGE_LABEL[proposal.bestRange]}</span>
        {best && (
          <span className={c.planFitPrice}>
            {best.planLabel}　{yen(best.estimate.total)}
          </span>
        )}
        {actions}
      </div>
      <p className={c.raise}>
        <small>こう切り出しましょう</small>「{proposal.howToRaise}」
      </p>
      <details className={c.why}>
        <summary>費用を抑える案・最後に尋ねること・幅ごとの見立て</summary>
      <p className={c.raise}>
        <small>費用を抑えるなら</small>「{proposal.budgetAlternative}」
      </p>
      <p className={c.raise}>
        <small>最後に尋ねる</small>「{proposal.closingQuestion}」
      </p>
      <ul className={c.rangeFits}>
        {proposal.ranges.map((r) => {
          const plan = plans.find((p) => p.range === r.range);
          const said = quote(r.utteranceIds);
          return (
            <li key={r.range} className={r.range === proposal.bestRange ? c.rangeBest : undefined}>
              <span className={c.rangeName}>
                {RANGE_LABEL[r.range]}
                {plan && <small>{yen(plan.estimate.total)}</small>}
              </span>
              <span>
                {r.fitsBecause && <span className={c.rangeFit}>合うところ：{r.fitsBecause}</span>}
                {r.watchOut && <span className={c.rangeWatch}>確かめたいこと：{r.watchOut}</span>}
                {said && <span className={c.rangeQuote}>「{said.slice(0, 30)}{said.length > 30 ? "…" : ""}」</span>}
              </span>
            </li>
          );
        })}
      </ul>
      <p className={c.planFitNote}>並びは費用を抑える順です。どの幅にするかを決めるのはご家族です。</p>
      </details>
    </article>
  );
}
