import { OPENING_STEPS, openingCovered } from "../../domain/opening";
import type { CaseState } from "../../engine/case";
import { CheckIcon } from "./TaskBoard";
import o from "./opening.module.css";

/**
 * 打合せの入り方。決めることより先に、ご家族のお話を引き出す声かけを順に並べる。
 * 会話で触れたものには ✓ が付く。声かけは例で、使うかどうかは担当者が決める
 */
export function OpeningCard({ state }: { readonly state: CaseState }) {
  const covered = openingCovered(state.utterances);
  const next = OPENING_STEPS.find((s) => !covered.has(s.id));
  return (
    <section className={o.card} aria-labelledby="opening-title" data-testid="opening">
      <h3 id="opening-title" className={o.title}>
        まず、お話を伺う
        <span className={o.sub}>決めることは、お話が一段落してから</span>
      </h3>
      <ol className={o.steps}>
        {OPENING_STEPS.map((s) => {
          const done = covered.has(s.id);
          const current = s.id === next?.id;
          return (
            <li key={s.id} className={`${o.step} ${done ? o.done : ""} ${current ? o.current : ""}`} aria-current={current ? "step" : undefined}>
              <span className={o.mark} aria-hidden="true">
                {done ? <CheckIcon /> : null}
              </span>
              <div>
                <b>{s.title}</b>
                {done && <span className={o.doneLabel}>伺いました</span>}
                {!done && (
                  <>
                    <p className={o.say}>「{s.say}」</p>
                    {current && (
                      <details className={o.why}>
                        <summary>なぜ先に</summary>
                        <p>{s.why}</p>
                      </details>
                    )}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
