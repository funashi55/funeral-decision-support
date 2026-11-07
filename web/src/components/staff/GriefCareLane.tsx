import { getGriefPrinciple } from "../../domain/griefCare";
import type { CaseState } from "../../engine/case";
import type { FarewellRecommendation } from "../../engine/farewell";
import c from "./console.module.css";

interface GriefCareLaneProps {
  readonly state: CaseState;
  readonly items: FarewellRecommendation["griefCare"];
  /** 項目ごとの操作（伝えた／使わない） */
  readonly actions?: (principleId: string) => React.ReactNode;
}

/**
 * ご遺族への配慮（グリーフケア）。会話から当てはまる考え方を選び、かける言葉の例を出す。
 * 理論・出典・避けたい言葉はサーバーではなく domain の固定の記述から出す。言葉は例で、使うかは担当者が決める
 */
export function GriefCareLane({ state, items, actions }: GriefCareLaneProps) {
  if (items.length === 0) return null;
  return (
    <div className={c.lane} data-testid="grief-care">
      {items.map((g) => {
        const p = getGriefPrinciple(g.principleId);
        const quote = state.utterances.find((u) => u.id === g.utteranceIds.at(-1));
        return (
          <article key={g.principleId} className={c.care}>
            <h4>{p.name}</h4>
            <p className={c.careWords}>
              <small>かける言葉の例</small>「{g.words}」
            </p>
            {actions?.(g.principleId)}
            <details className={c.careMore}>
              <summary>なぜ・ほかの言い方・避けたい言葉</summary>
              <p className={c.careWhy}>
                {g.observation}
                {quote && <span className={c.careQuote}>（「{quote.text.slice(0, 24)}{quote.text.length > 24 ? "…" : ""}」）</span>}
              </p>
              <dl>
                <dt>考え方</dt>
                <dd>{p.principle}</dd>
                <dt>ほかの言い方</dt>
                <dd>
                  {p.sayExamples.map((w) => (
                    <span key={w} className={c.careSay}>「{w}」</span>
                  ))}
                </dd>
                <dt>避けたい言葉</dt>
                <dd>
                  <ul>
                    {p.avoid.map((a) => (
                      <li key={a.words}>
                        <s>「{a.words}」</s> — {a.why}
                      </li>
                    ))}
                  </ul>
                </dd>
                <dt>拠りどころ</dt>
                <dd>
                  {p.theory}
                  <br />
                  <cite>{p.source}</cite>
                </dd>
              </dl>
            </details>
          </article>
        );
      })}
      <p className={c.careNote}>言葉は例です。使うかどうかは担当者が決めます。</p>
    </div>
  );
}
