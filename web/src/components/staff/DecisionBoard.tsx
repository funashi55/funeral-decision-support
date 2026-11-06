"use client";
import { useState } from "react";
import { DECISIONS, PHASE_LABEL, type DecisionItem } from "../../domain/decisions";
import type { CaseState } from "../../engine/case";
import c from "./console.module.css";
import s from "./staff.module.css";

interface DecisionBoardProps {
  readonly state: CaseState;
  /** 直前に変わった決定の影響を受け、見直しが必要な項目 */
  readonly impacted: ReadonlySet<string>;
  readonly onConfirm: (decisionId: string, value: string) => void;
}

/** 候補を確定する。言い間違いや聞き取りの誤りは、直してから確定できる */
export function ConfirmControl({ item, value, onConfirm }: { item: DecisionItem; value: string; onConfirm: DecisionBoardProps["onConfirm"] }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (editing) {
    return (
      <form
        className={s.editForm}
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) onConfirm(item.id, draft.trim());
          setEditing(false);
        }}
      >
        <input aria-label={`${item.label}の内容`} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={200} autoFocus />
        <button type="submit" className={s.confirm}>
          確定
        </button>
      </form>
    );
  }
  return (
    <span className={s.confirmRow}>
      <button type="button" className={s.linkBtn} onClick={() => setEditing(true)}>
        直す
      </button>
      <button type="button" className={s.confirm} onClick={() => onConfirm(item.id, value)}>
        確定する
      </button>
    </span>
  );
}

/** まだの項目に、担当者が手で内容を入れて確定する */
export function ManualEntry({ item, onConfirm }: { readonly item: DecisionItem; readonly onConfirm: DecisionBoardProps["onConfirm"] }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  if (!open) {
    return (
      <button type="button" className={c.todoEnter} onClick={() => setOpen(true)}>
        記入する
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

const PHASES = ["trust", "hearing", "farewell", "schedule", "plan", "logistics", "after"] as const;

/**
 * 決めること：全項目を打合せの段階ごとに並べた、シンプルなチェックリスト。
 * ✓ 決まった／● 候補が出ている（確定を待つ）／○ まだ。候補は確定、まだの項目は手で入れられる
 */
export function DecisionBoard({ state, impacted, onConfirm }: DecisionBoardProps) {
  const confirmed = DECISIONS.filter((d) => state.decisions[d.id]?.status === "confirmed").length;
  return (
    <section aria-labelledby="board-title" className={c.checklist}>
      <h2 id="board-title" className={c.blockTitle}>
        決めること
      </h2>
      <p className={c.todoCount}>
        決まった <b>{confirmed}</b> / {DECISIONS.length}
      </p>
      <div className={c.todoBar} aria-hidden="true">
        <i style={{ width: `${(confirmed / DECISIONS.length) * 100}%` }} />
      </div>
      {PHASES.map((phase) => {
        const items = DECISIONS.filter((d) => d.phase === phase);
        if (items.length === 0) return null;
        return (
          <div key={phase}>
            <h3 className={c.todoGroup}>{PHASE_LABEL[phase]}</h3>
            <ul className={c.todoList}>
              {items.map((d) => {
                const decision = state.decisions[d.id];
                const done = decision?.status === "confirmed";
                const waiting = decision?.status === "candidate" || (impacted.has(d.id) && !done);
                return (
                  <li key={d.id} className={`${c.todoItem} ${done ? c.todoDone : waiting ? c.todoWaiting : ""}`}>
                    <span className={c.todoMark} aria-hidden="true">
                      {done ? "✓" : waiting ? "●" : "○"}
                    </span>
                    <span className={c.todoText}>
                      {d.label}
                      {d.urgency === "today" && !done && <span className={c.todayTag}>今日</span>}
                      {decision && <small>{impacted.has(d.id) && !done ? "見直しが必要です" : decision.value}</small>}
                    </span>
                    {done ? null : decision ? <ConfirmControl item={d} value={decision.value} onConfirm={onConfirm} /> : <ManualEntry item={d} onConfirm={onConfirm} />}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
