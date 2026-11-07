"use client";
import { useState } from "react";
import { DECISIONS, PHASE_LABEL, type DecisionItem } from "../../domain/decisions";
import type { CaseState } from "../../engine/case";
import t from "./tasks.module.css";

interface TaskBoardProps {
  readonly state: CaseState;
  /** 直前に変わった決定の影響を受け、見直しが必要な項目 */
  readonly impacted: ReadonlySet<string>;
  readonly onConfirm: (decisionId: string, value: string) => void;
}

type View = "all" | "today" | "candidate";
const VIEWS: readonly { readonly id: View; readonly label: string }[] = [
  { id: "all", label: "すべて" },
  { id: "today", label: "今日" },
  { id: "candidate", label: "候補あり" },
];
const PHASES = ["trust", "hearing", "farewell", "schedule", "plan", "logistics", "after"] as const;

export function TaskBoard({ state, impacted, onConfirm }: TaskBoardProps) {
  const [view, setView] = useState<View>("all");
  const status = (d: DecisionItem) => state.decisions[d.id]?.status;
  const done = DECISIONS.filter((d) => status(d) === "confirmed");
  const open = DECISIONS.filter((d) => status(d) !== "confirmed");
  const shown = open.filter((d) => (view === "today" ? d.urgency === "today" : view === "candidate" ? status(d) === "candidate" || impacted.has(d.id) : true));
  const countOf = (v: View) => open.filter((d) => (v === "today" ? d.urgency === "today" : v === "candidate" ? status(d) === "candidate" || impacted.has(d.id) : true)).length;

  return (
    <section aria-labelledby="board-title" className={t.board}>
      <header className={t.head}>
        <h2 id="board-title">決めること</h2>
        <p className={t.progress}>
          <b>{done.length}</b>/{DECISIONS.length} 決まった
          <span className={t.bar} aria-hidden="true">
            <i style={{ width: `${(done.length / DECISIONS.length) * 100}%` }} />
          </span>
        </p>
      </header>

      <div className={t.views} role="group" aria-label="表示する項目">
        <span className={t.legend} aria-hidden="true">
          <i className={`${t.check} ${t.checkToday}`} />
          今日決める
        </span>
        {VIEWS.map((v) => (
          <button key={v.id} type="button" className={t.view} aria-pressed={view === v.id} onClick={() => setView(v.id)}>
            {v.label}
            <span>{countOf(v.id)}</span>
          </button>
        ))}
      </div>

      {PHASES.map((phase) => {
        const items = shown.filter((d) => d.phase === phase);
        if (items.length === 0) return null;
        return (
          <details key={phase} className={t.section} open>
            <summary>
              <span className={t.chevron} aria-hidden="true" />
              {PHASE_LABEL[phase]}
              <span className={t.sectionCount}>{items.length}</span>
            </summary>
            <ul className={t.list}>
              {items.map((d) => (
                <TaskRow key={d.id} item={d} state={state} impacted={impacted.has(d.id)} onConfirm={onConfirm} />
              ))}
            </ul>
          </details>
        );
      })}
      {shown.length === 0 && <p className={t.empty}>この表示に当てはまる項目はありません</p>}

      {done.length > 0 && (
        <details className={`${t.section} ${t.doneSection}`}>
          <summary>
            <span className={t.chevron} aria-hidden="true" />
            完了
            <span className={t.sectionCount}>{done.length}</span>
          </summary>
          <ul className={t.list}>
            {done.map((d) => (
              <li key={d.id} className={`${t.row} ${t.rowDone}`}>
                <span className={`${t.check} ${t.checkDone}`} aria-hidden="true">
                  <CheckIcon />
                </span>
                <span className={t.body}>
                  <span className={t.title}>{d.label}</span>
                  <span className={t.meta}>{state.decisions[d.id]?.value}</span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/** 1行：丸（確定）・項目名・候補や期限の小さな情報・編集 */
function TaskRow({ item, state, impacted, onConfirm }: { readonly item: DecisionItem; readonly state: CaseState; readonly impacted: boolean; readonly onConfirm: TaskBoardProps["onConfirm"] }) {
  const decision = state.decisions[item.id];
  const candidate = decision?.status === "candidate" ? decision.value : undefined;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(candidate ?? "");
  const startEdit = () => {
    setDraft(candidate ?? decision?.value ?? "");
    setEditing(true);
  };
  const save = () => {
    if (draft.trim()) onConfirm(item.id, draft.trim());
    setEditing(false);
  };

  return (
    <li className={`${t.row} ${candidate ? t.rowCandidate : ""} ${impacted ? t.rowImpacted : ""}`}>
      <button
        type="button"
        className={`${t.check} ${item.urgency === "today" ? t.checkToday : ""}`}
        onClick={() => (candidate && !impacted ? onConfirm(item.id, candidate) : startEdit())}
        aria-label={candidate && !impacted ? `${item.label}を「${candidate}」で確定する` : `${item.label}を記入して確定する`}
        title={`${item.urgency === "today" ? "今日決める・" : ""}${candidate && !impacted ? "この内容で確定" : "記入して確定"}`}
      >
        <CheckIcon />
      </button>
      <span className={t.body}>
        <span className={t.title}>{item.label}</span>
        {editing ? (
          <form
            className={t.edit}
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <input
              aria-label={`${item.label}の内容`}
              value={draft}
              maxLength={200}
              autoFocus
              placeholder="決まった内容"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
            />
            <button type="submit" disabled={!draft.trim()}>
              確定
            </button>
            <button type="button" className={t.cancel} onClick={() => setEditing(false)}>
              やめる
            </button>
          </form>
        ) : (
          <span className={t.meta}>
            {impacted && <span className={t.warn}>見直しが必要</span>}
            {candidate && (
              <span className={t.candidate}>
                <SparkIcon />
                候補：{candidate}
              </span>
            )}
          </span>
        )}
      </span>
      {!editing && (
        <button type="button" className={t.edit_btn} onClick={startEdit} aria-label={`${item.label}を${candidate ? "直す" : "記入する"}`} title={candidate ? "直す" : "記入する"}>
          <PencilIcon />
        </button>
      )}
    </li>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
      <path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9z" />
    </svg>
  );
}
function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
