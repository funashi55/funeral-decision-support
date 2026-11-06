import { useState } from "react";
import { DECISIONS, type DecisionItem } from "../../domain/decisions";
import type { CaseState } from "../../engine/case";
import { TODO_TEXT_MAX, todosOf } from "../../engine/todos";
import type { FarewellResult } from "../../engine/farewell";
import type { OversightAlert } from "../../engine/oversight";
import { ConfirmControl } from "./DecisionBoard";
import { GriefCareLane } from "./GriefCareLane";
import { PlanFitCard } from "./PlanFitCard";
import type { PlanFitProposal } from "../../engine/planFit";
import { FeedbackButtons, type FeedbackHandler } from "./FeedbackButtons";
import c from "./console.module.css";
import s from "./staff.module.css";

interface NowViewProps {
  readonly state: CaseState;
  readonly impacted: ReadonlySet<string>;
  readonly oversights: readonly OversightAlert[];
  readonly farewell: FarewellResult | null;
  /** プランの見立て（費用の話ができる段階に入ってから出る） */
  readonly planFit: PlanFitProposal | null;
  /** 推奨を考えている途中か */
  readonly thinking: boolean;
  readonly onConfirm: (decisionId: string, value: string) => void;
  /** 担当者が自分で足すやること（足す・済みにする・消す） */
  readonly onTodo: TodoHandler;
  readonly onFeedback: FeedbackHandler;
  /** お別れの仕方の詳しい比較と根拠（FarewellPanel）。畳んで置く */
  readonly children: React.ReactNode;
}

export type TodoAction = { readonly action: "add"; readonly text: string } | { readonly action: "done"; readonly id: string; readonly done: boolean } | { readonly action: "remove"; readonly id: string };
export type TodoHandler = (body: TodoAction) => void;

const FIT_TEXT = { suits: "合う", consider: "尋ねてみる" } as const;

/**
 * 「いま」：打合せの最中に担当者が見る 1 枚。
 * 左に「この流れでの提案」と「確認・注意」、右に「やることリスト」（会話から自動で埋まり、残りが見える）
 */
export function NowView({ state, impacted, oversights, farewell, planFit, thinking, onConfirm, onTodo, onFeedback, children }: NowViewProps) {
  const rec = farewell?.ok ? farewell.recommendation : null;
  const proposals = (rec?.options ?? []).filter((o) => o.fit !== "not_now").sort((a, b) => (a.fit === b.fit ? 0 : a.fit === "suits" ? -1 : 1));
  // 推奨が挙げた注意。決まりごとの検出と同じ項目は重ねて出さない
  const aiCautions = (rec?.cautions ?? []).filter((x) => !oversights.some((o) => o.decisionLabel === x.label));
  const questions = rec?.questionsToAsk ?? [];
  const checkCount = oversights.length + aiCautions.length + questions.length;

  return (
    <div className={`${c.view} ${c.wide} ${c.nowGrid}`}>
      <div className={c.nowMain}>
        <section aria-labelledby="proposal-title" className={c.block}>
          <h2 id="proposal-title" className={c.blockTitle}>
            この流れでの提案
            {thinking && <span className={c.thinking}>考えています…</span>}
          </h2>
          {!rec && <p className={c.quiet}>ご家族のお話が進むと、この会話に合わせた提案と、切り出し方の例がここに出ます。</p>}
          {rec && (
            <>
              <p className={c.wishBand}>
                <small>ご家族が望んでいること</small>
                {rec.familyWish}
              </p>
              <ul className={c.proposals}>
                {proposals.map((o) => (
                  <li key={o.id} className={c.proposal}>
                    <div className={c.proposalHead}>
                      <b>{o.label}</b>
                      <span className={o.fit === "suits" ? c.fitSuits : c.fitAsk}>{FIT_TEXT[o.fit as keyof typeof FIT_TEXT]}</span>
                    </div>
                    <p className={c.raise}>
                      <small>こう切り出しましょう</small>「{o.howToRaise}」
                    </p>
                    <p className={c.reason}>{o.reason}</p>
                  </li>
                ))}
              </ul>
              {planFit && <PlanFitCard state={state} proposal={planFit} />}
              {rec.timeAdvice && (
                <p className={c.timeAdvice}>
                  <small>日程について</small>
                  {rec.timeAdvice}
                </p>
              )}
            </>
          )}
          <GriefCareLane state={state} items={rec?.griefCare ?? []} />
          <details className={c.more}>
            <summary>選択肢の比較と根拠をすべて見る</summary>
            {children}
          </details>
        </section>

        <section aria-labelledby="check-title" className={c.block} data-testid="oversights">
          <h2 id="check-title" className={c.blockTitle}>
            確認・注意<span className={c.laneCount}>{checkCount}</span>
          </h2>
          {checkCount === 0 && <p className={c.quiet}>確かめておくことや、取り消せない手配の注意がここに出ます。</p>}
          {oversights.map((a) => (
            <article key={a.id} className={c.alert}>
              <h4>
                <span className={c.tagWarn}>注意</span>
                {a.decisionLabel}
              </h4>
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
              <h4>
                <span className={c.tagWarn}>注意</span>
                {x.label}
              </h4>
              <p>{x.message}</p>
            </article>
          ))}
          {questions.length > 0 && (
            <ul className={c.questions}>
              {questions.map((q) => (
                <li key={q}>
                  <span className={c.tagAsk}>確認</span>
                  {q}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <TodoList state={state} impacted={impacted} onConfirm={onConfirm} onTodo={onTodo} />
    </div>
  );
}

/**
 * 今日決めることを打合せの順に並べる。会話から候補が入ると上がり、確定すると ✓ が付く。
 * まだの項目は手でも入れられ、一覧にない用事は自分で足せる
 */
function TodoList({ state, impacted, onConfirm, onTodo }: Pick<NowViewProps, "state" | "impacted" | "onConfirm" | "onTodo">) {
  const today = DECISIONS.filter((d) => d.urgency === "today");
  const done = today.filter((d) => state.decisions[d.id]?.status === "confirmed");
  const waiting = DECISIONS.filter((d) => state.decisions[d.id]?.status === "candidate" || (impacted.has(d.id) && state.decisions[d.id]?.status !== "confirmed"));
  const open = today.filter((d) => !state.decisions[d.id] && !impacted.has(d.id));
  const customs = todosOf(state);
  const total = today.length + customs.length;
  const finished = done.length + customs.filter((t) => t.done).length;
  return (
    <aside className={c.todo} aria-labelledby="todo-title">
      <h2 id="todo-title" className={c.blockTitle}>
        やることリスト
      </h2>
      <p className={c.todoCount}>
        残り <b>{total - finished}</b> / {total}
      </p>
      <div className={c.todoBar} aria-hidden="true">
        <i style={{ width: `${(finished / Math.max(total, 1)) * 100}%` }} />
      </div>

      {waiting.length > 0 && (
        <>
          <h3 className={c.todoGroup}>確定を待つ {waiting.length}</h3>
          <ul className={c.todoList}>
            {waiting.map((d) => {
              const value = state.decisions[d.id]?.value;
              return (
                <li key={d.id} className={`${c.todoItem} ${c.todoWaiting} ${impacted.has(d.id) ? c.todoImpacted : ""}`}>
                  <span className={c.todoMark} aria-hidden="true">●</span>
                  <span className={c.todoText}>
                    {d.label}
                    <small>{impacted.has(d.id) ? "見直しが必要です" : value}</small>
                  </span>
                  {value ? <ConfirmControl item={d} value={value} onConfirm={onConfirm} /> : <ManualEntry item={d} onConfirm={onConfirm} />}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {open.length > 0 && (
        <>
          <h3 className={c.todoGroup}>まだ {open.length}</h3>
          <ul className={c.todoList}>
            {open.map((d) => (
              <li key={d.id} className={c.todoItem}>
                <span className={c.todoMark} aria-hidden="true">○</span>
                <span className={c.todoText}>{d.label}</span>
                <ManualEntry item={d} onConfirm={onConfirm} />
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className={c.todoGroup}>自分で足したこと {customs.length > 0 ? customs.length : ""}</h3>
      {customs.length > 0 && (
        <ul className={c.todoList}>
          {customs.map((t) => (
            <li key={t.id} className={`${c.todoItem} ${t.done ? c.todoDone : ""}`}>
              <button
                type="button"
                className={c.todoCheck}
                aria-pressed={t.done}
                aria-label={t.done ? `「${t.text}」を未済に戻す` : `「${t.text}」を済みにする`}
                onClick={() => onTodo({ action: "done", id: t.id, done: !t.done })}
              >
                {t.done ? "✓" : ""}
              </button>
              <span className={c.todoText}>{t.text}</span>
              <button type="button" className={c.todoRemove} aria-label={`「${t.text}」を消す`} onClick={() => onTodo({ action: "remove", id: t.id })}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <AddTodo onAdd={(text) => onTodo({ action: "add", text })} />

      {done.length > 0 && (
        <>
          <h3 className={c.todoGroup}>決まった {done.length}</h3>
          <ul className={c.todoList}>
            {done.map((d) => (
              <li key={d.id} className={`${c.todoItem} ${c.todoDone}`}>
                <span className={c.todoMark} aria-hidden="true">✓</span>
                <span className={c.todoText}>
                  {d.label}
                  <small>{state.decisions[d.id]?.value}</small>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}

/** まだの項目に、担当者が手で内容を入れて確定する */
function ManualEntry({ item, onConfirm }: { readonly item: DecisionItem; readonly onConfirm: NowViewProps["onConfirm"] }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  if (!open) {
    return (
      <button type="button" className={c.todoEnter} onClick={() => setOpen(true)}>
        入れる
      </button>
    );
  }
  return (
    <form
      className={c.todoForm}
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.trim()) return;
        onConfirm(item.id, value.trim());
        setOpen(false);
        setValue("");
      }}
    >
      <input aria-label={`${item.label}の内容`} value={value} maxLength={200} autoFocus onChange={(e) => setValue(e.target.value)} />
      <button type="submit" disabled={!value.trim()}>
        確定
      </button>
      <button type="button" className={c.todoCancel} onClick={() => setOpen(false)}>
        やめる
      </button>
    </form>
  );
}

/** 一覧にない用事を、自分で足す */
function AddTodo({ onAdd }: { readonly onAdd: (text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <form
      className={c.todoForm}
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        onAdd(text.trim());
        setText("");
      }}
    >
      <input aria-label="やることを足す" placeholder="やることを足す（例：親戚に到着時刻を確かめる）" value={text} maxLength={TODO_TEXT_MAX} onChange={(e) => setText(e.target.value)} />
      <button type="submit" disabled={!text.trim()}>
        足す
      </button>
    </form>
  );
}
