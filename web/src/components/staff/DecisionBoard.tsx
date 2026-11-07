"use client";
import { useState } from "react";
import type { DecisionItem } from "../../domain/decisions";
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
      <button type="button" className={c.todoEnter} onClick={() => setOpen(true)} aria-label={`${item.label}を記入する`} title="記入する">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
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

/**
 * 決めること：タスク管理アプリ（Todoist・Things など）の一覧の形にならう。
 * 左の丸を押すと確定（候補があればその内容で、なければ入力欄が開く）。段階ごとの見出しは畳める。決まったものは下の「完了」へ
 */
export { TaskBoard as DecisionBoard } from "./TaskBoard";
