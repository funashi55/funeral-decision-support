"use client";
import { useState, type Ref } from "react";
import { api } from "../../client/api";
import type { FamilyDecided } from "../../engine/familyView";
import { REQUEST_TEXT_MAX } from "../../engine/requests";
import s from "./family.module.css";

export interface ComposerDraft {
  readonly kind: "change" | "question";
  readonly decisionId: string | null;
}

interface RequestComposerProps {
  readonly ref: Ref<HTMLElement>;
  readonly token: string;
  readonly decided: readonly FamilyDecided[];
  readonly draft: ComposerDraft;
  readonly onDraftChange: (draft: ComposerDraft) => void;
  readonly onSent: () => void;
}

export function RequestComposer({ ref, token, decided, draft, onDraftChange, onSent }: RequestComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentNotice, setSentNotice] = useState(false);

  const canChange = decided.length > 0;
  const needsDecision = draft.kind === "change" && draft.decisionId === null;
  const tooLong = text.length > REQUEST_TEXT_MAX;
  const disabled = sending || text.trim().length === 0 || needsDecision || tooLong;

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (disabled) return;
    setSending(true);
    setError(null);
    try {
      await api.sendFamilyRequest(token, { kind: draft.kind, decisionId: draft.decisionId, text });
      setText("");
      setSentNotice(true);
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "送れませんでした。もう一度お試しください");
    } finally {
      setSending(false);
    }
  };

  return (
    <section ref={ref} className={`${s.section} ${s.composer}`} aria-labelledby="composer-title" data-guide="composer">
      <div className={s.sectionHead}>
        <h2 id="composer-title">担当者に伝える</h2>
      </div>
      <form onSubmit={(e) => void submit(e)}>
        <div className={s.segment} role="radiogroup" aria-label="伝えたいこと">
          <button type="button" role="radio" aria-checked={draft.kind === "question"} onClick={() => onDraftChange({ kind: "question", decisionId: null })}>
            聞きたいこと
          </button>
          <button type="button" role="radio" aria-checked={draft.kind === "change"} disabled={!canChange} onClick={() => onDraftChange({ kind: "change", decisionId: draft.decisionId })}>
            変えたいこと
          </button>
        </div>
        {draft.kind === "change" && (
          <label className={s.field}>
            <span>どの決定についてですか</span>
            <select value={draft.decisionId ?? ""} onChange={(e) => onDraftChange({ kind: "change", decisionId: e.target.value || null })}>
              <option value="">選んでください</option>
              {decided.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}（{d.value}）
                </option>
              ))}
            </select>
          </label>
        )}
        <label className={s.field}>
          <span>{draft.kind === "change" ? "どのように変えたいですか" : "聞きたいこと"}</span>
          <textarea
            value={text}
            rows={4}
            placeholder={draft.kind === "change" ? "例：孫の到着に合わせて、火葬を1日遅らせたい" : "例：数珠は持っていったほうがよいですか"}
            onChange={(e) => {
              setText(e.target.value);
              setSentNotice(false);
            }}
          />
          <span className={`${s.counter} ${tooLong ? s.counterOver : ""}`}>
            {text.length} / {REQUEST_TEXT_MAX}
          </span>
        </label>
        {error && <p className={s.error} role="alert">{error}</p>}
        {sentNotice && <p className={s.sent} role="status">担当者に届きました。</p>}
        <button type="submit" className={s.submit} disabled={disabled}>
          {sending ? "送っています…" : "担当者に送る"}
        </button>
      </form>
    </section>
  );
}
