import { FAREWELL_OPTIONS } from "../../domain/farewell";
import { yen } from "../../domain/pricing";
import type { QuickFit } from "../../engine/quickFit";
import type { CaseState } from "../../engine/case";
import type { EnrichedOption, FarewellResult, OptionFacts } from "../../engine/farewell";
import { FeedbackButtons, type FeedbackHandler } from "./FeedbackButtons";
import s from "./staff.module.css";

interface FarewellPanelProps {
  readonly state: CaseState;
  readonly result: FarewellResult | null;
  /** 推奨（理由づけ）がどの発言までを見て書かれたか */
  readonly resultBasedOn: number;
  readonly quick: QuickFit | null;
  readonly listening: boolean;
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

/** できること・できないこと。サーバーが持つ事実で、モデルは書かない */
function CanList({ option }: { readonly option: OptionFacts }) {
  return (
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
  );
}

function FactTags({ option }: { readonly option: OptionFacts }) {
  return (
    <>
      <span className={`${s.tag} ${option.reversible ? "" : s.tagWarn}`}>{option.reversible ? "後から変更できる" : "後から取り消せない"}</span>
      <span className={s.tag}>決める期限：{option.deadline}</span>
    </>
  );
}

function FactsBody({ option }: { readonly option: OptionFacts }) {
  return (
    <>
      <CanList option={option} />
      <div className={s.meta2}>
        <FactTags option={option} />
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
      {option.howToRaise && (
        <p className={s.raise}>
          <small>{option.fit === "not_now" ? "触れるなら" : "切り出し方の例"}</small>「{option.howToRaise}」
        </p>
      )}
      <div className={s.meta2}>
        <FactTags option={option} />
        <FeedbackButtons state={state} target={`farewell:${option.id}`} onFeedback={onFeedback} />
      </div>
      <details className={s.evidence}>
        <summary>できること・できないこと{quotes.length > 0 || option.evidence.rules.length > 0 ? "と根拠" : ""}</summary>
        <CanList option={option} />
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
    </article>
  );
}

/** いまの見立て：発言のたびに約2秒で更新される。理由と根拠はその下の推奨が書く */
function QuickStrip({ quick, listening, stale }: { readonly quick: QuickFit | null; readonly listening: boolean; readonly stale: boolean }) {
  if (!quick && !listening) return null;
  return (
    <section className={s.quick} aria-label="いまの見立て" aria-live="polite" data-testid="quick-fit">
      <div className={s.quickHead}>
        <b>いまの見立て</b>
        <span className={s.count}>
          {listening ? "聞きながら考えています…" : quick ? `${quick.basedOn}発言目まで・${(quick.ms / 1000).toFixed(1)}秒` : ""}
        </span>
      </div>
      {quick && (
        <ul className={s.quickList}>
          {FAREWELL_OPTIONS.map((o) => (
            <li key={o.id} data-fit={quick.fits[o.id]}>
              <span className={`${s.fit} ${FIT_CLASS[quick.fits[o.id]]}`}>{FIT_LABEL[quick.fits[o.id]]}</span>
              {o.label}
            </li>
          ))}
        </ul>
      )}
      {stale && <p className={s.count}>下の理由は、少し前の発言までで書いたものです。新しい見立てに合わせて書き直しています…</p>}
    </section>
  );
}

/** 推奨を書いている間の仮の枠。文字だけの「考えています…」より、どこに何が出るかがわかる */
function Skeleton() {
  return (
    <div className={s.skeleton} aria-label="推奨を書いています" role="status">
      <i className={s.skWish} />
      <i />
      <i />
      <i className={s.skShort} />
    </div>
  );
}

export function FarewellPanel({ state, result, resultBasedOn, quick, listening, loading, error, onRun, onFeedback }: FarewellPanelProps) {
  const stale = Boolean(result?.ok && quick && loading && quick.basedOn > resultBasedOn);
  return (
    <>
      <QuickStrip quick={quick} listening={listening} stale={stale} />
      <div className={s.toolbar}>
        <span className={s.count}>となりのベテランから</span>
        <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={onRun} disabled={loading || state.utterances.length === 0}>
          {loading ? "考えています…" : result ? "考え直す" : "お別れの仕方を考える"}
        </button>
      </div>
      {error && <p className={s.error} role="alert">{error}</p>}
      <div className={s.scroll} aria-live="polite">
        {!result && !loading && (
          <div className={s.emptyState}>
            <p className={s.emptyTitle}>会話が進むと、ここに推奨が出ます</p>
            <p>お別れの仕方の選択肢を、ご遺族の言葉・ベテランの知見・似た家族の選び方と並べて示します。推奨はこの画面にだけ出ます。伝えるかどうかは担当者が決めます。</p>
          </div>
        )}
        {!result && loading && <Skeleton />}
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
          </>
        )}
      </div>
    </>
  );
}
