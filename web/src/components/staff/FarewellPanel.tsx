import { yen } from "../../domain/pricing";
import type { CaseState } from "../../engine/case";
import type { EnrichedOption, FarewellResult, OptionFacts } from "../../engine/farewell";
import { FeedbackButtons, type FeedbackHandler } from "./FeedbackButtons";
import s from "./staff.module.css";

interface FarewellPanelProps {
  readonly state: CaseState;
  readonly result: FarewellResult | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly onRun: () => void;
  readonly onFeedback: FeedbackHandler;
}

const FIT_LABEL = { suits: "家族の望みに合う", consider: "尋ねてみる", not_now: "今回は合わない" } as const;
const FIT_CLASS = { suits: s.fitSuits, consider: s.fitConsider, not_now: s.fitNotNow } as const;
const UNIT_LABEL: Record<string, string> = { 式: "", 日: "／日", 名: "／名", 個: "／個" };

function Price({ option }: { readonly option: OptionFacts }) {
  return option.price ? (
    <span className={s.price}>
      {yen(option.price.amount)}
      {UNIT_LABEL[option.price.unit] ?? ""}
    </span>
  ) : (
    <span className={s.priceIncluded}>プランに含まれる</span>
  );
}

/** できること・できないこと・期限。サーバーが持つ事実で、モデルは書かない */
function FactsBody({ option }: { readonly option: OptionFacts }) {
  return (
    <>
      <div className={s.can}>
        <ul>
          <b>できること</b>
          {option.canDo.map((c) => (
            <li key={c}>・{c}</li>
          ))}
        </ul>
        <ul>
          <b>できないこと</b>
          {option.cannotDo.map((c) => (
            <li key={c}>・{c}</li>
          ))}
        </ul>
      </div>
      <div className={s.meta2}>
        <span className={`${s.tag} ${option.reversible ? "" : s.tagWarn}`}>{option.reversible ? "後から変更できる" : "後から取り消せない"}</span>
        <span className={s.tag}>決める期限：{option.deadline}</span>
      </div>
    </>
  );
}

function FactCard({ option }: { readonly option: OptionFacts }) {
  return (
    <article className={s.option} data-testid={`fact-${option.id}`}>
      <div className={s.optionHead}>
        <h3>{option.label}</h3>
        <Price option={option} />
      </div>
      <FactsBody option={option} />
    </article>
  );
}

function OptionCard({ option, state, onFeedback }: { option: EnrichedOption; state: CaseState; onFeedback: FeedbackHandler }) {
  const quotes = state.utterances.filter((u) => option.evidence.utteranceIds.includes(u.id));
  const cls = [s.option, option.fit === "suits" ? s.optionSuits : "", option.fit === "not_now" ? s.optionNotNow : ""].join(" ");
  return (
    <article className={cls}>
      <div className={s.optionHead}>
        <h3>
          <span className={`${s.fit} ${FIT_CLASS[option.fit]}`}>{FIT_LABEL[option.fit]}</span>
          {option.label}
        </h3>
        <Price option={option} />
      </div>
      <p className={s.reason}>{option.reason}</p>
      <FactsBody option={option} />
      <div className={s.meta2}>
        <FeedbackButtons state={state} target={`farewell:${option.id}`} onFeedback={onFeedback} />
      </div>
      {(quotes.length > 0 || option.evidence.rules.length > 0) && (
        <details className={s.evidence}>
          <summary>根拠を見る</summary>
          {quotes.map((u) => (
            <blockquote key={u.id}>
              {u.speakerLabel}：「{u.text}」
            </blockquote>
          ))}
          {option.evidence.rules.map((r) => (
            <blockquote key={r.id}>
              ベテランの知見（{r.id}）：{r.do}
              <br />
              元のメモ：「{r.source}」
            </blockquote>
          ))}
        </details>
      )}
    </article>
  );
}

export function FarewellPanel({ state, result, loading, error, onRun, onFeedback }: FarewellPanelProps) {
  return (
    <>
      <div className={s.toolbar}>
        <span className={s.count}>となりのベテランから</span>
        <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={onRun} disabled={loading || state.utterances.length === 0}>
          {loading ? "考えています…" : result ? "考え直す" : "お別れの仕方を考える"}
        </button>
      </div>
      {error && <p className={s.error} role="alert">{error}</p>}
      <div className={s.scroll} aria-live="polite">
        {!result && !loading && (
          <p className={s.empty}>
            家族の事情が見えてきたら、お別れの仕方の選択肢を、家族の言葉・ベテランの知見・似た家族の選び方と並べて示します。
            <br />
            推奨はこの画面にだけ出ます。伝えるかどうかは担当者が決めます。
          </p>
        )}
        {result && !result.ok && (
          <>
            <p className={s.error} role="alert">
              守る線の検査を通る推奨を作れなかったため、推奨は出していません。代わりに、選択肢の事実だけを並べます（費用のかからないものから）。どれが合うかは、ご家族の言葉を聞いて判断してください。
            </p>
            <details className={s.evidence} style={{ margin: "0 0 0.8rem" }}>
              <summary>止めた理由を見る</summary>
              {result.violations.map((v, i) => (
                <blockquote key={i}>{v.message}</blockquote>
              ))}
            </details>
            {result.facts.map((f) => (
              <FactCard key={f.id} option={f} />
            ))}
          </>
        )}
        {result?.ok && (
          <>
            <div className={s.wish}>
              <small>家族が望んでいるお別れ</small>
              <p>{result.recommendation.familyWish}</p>
            </div>
            <div className={s.guardBar}>
              <span className={s.guardOk}>✓ 守る線の検査を通過</span>
              {result.rejected.length > 0 && (
                <span className={s.guardRejected}>
                  最初の案は差し戻し：{[...new Set(result.rejected.map((v) => v.message))].join("／")}
                </span>
              )}
            </div>
            {result.recommendation.options.map((o) => (
              <OptionCard key={o.id} option={o} state={state} onFeedback={onFeedback} />
            ))}
            {result.recommendation.references.length > 0 && (
              <div className={s.refs}>
                <h3>似た家族の選び方（参考）</h3>
                <small>{result.recommendation.referenceSource}。多数派に合わせる必要はありません</small>
                {result.recommendation.references.map((r) => (
                  <div key={r.id} className={s.ref}>
                    <span>
                      {r.cohort}：{r.measure}
                    </span>
                    <span className={s.refPct}>
                      {r.percent}%<span className={s.count}>（{r.count.toLocaleString("ja-JP")}件）</span>
                    </span>
                    <span className={s.bar}>
                      <i style={{ width: `${r.percent}%` }} />
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className={s.advice}>
              <h3>火葬までの時間の使い方</h3>
              <p>{result.recommendation.timeAdvice}</p>
            </div>
            {result.recommendation.questionsToAsk.length > 0 && (
              <div className={s.advice}>
                <h3>家族に尋ねてみる</h3>
                <ul>
                  {result.recommendation.questionsToAsk.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.recommendation.cautions.map((c) => (
              <div key={c.decisionId + c.message} className={`${s.advice} ${s.caution}`}>
                <h3>見落とし注意：{c.label}</h3>
                <p>{c.message}</p>
              </div>
            ))}
          </>
        )}
      </div>
    </>
  );
}
