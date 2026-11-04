"use client";
import { useState } from "react";
import type { CaseState, Utterance } from "../../engine/case";
import { InputDock, type NewLine } from "./InputDock";
import s from "./staff.module.css";

interface TranscriptProps {
  readonly state: CaseState;
  readonly extracting: boolean;
  readonly onAdd: (line: NewLine) => Promise<void>;
  readonly onEdit: (utteranceId: string, text: string) => Promise<void>;
}

const mmss = (sec: number): string => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

function Line({ u, onEdit }: { readonly u: Utterance; readonly onEdit: TranscriptProps["onEdit"] }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(u.text);
  return (
    <div className={`${s.utt} ${u.speaker === "staff" ? s.uttStaff : ""}`} data-testid={`utt-${u.id}`}>
      <span className={s.uttWho}>
        <span>{u.speakerLabel}</span>
        <span>
          {mmss(u.at)}
          {!editing && (
            <button type="button" className={s.linkBtn} onClick={() => setEditing(true)} aria-label={`${u.id}の字幕を直す`}>
              直す
            </button>
          )}
        </span>
      </span>
      {editing ? (
        <form
          className={s.editForm}
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) void onEdit(u.id, draft.trim());
            setEditing(false);
          }}
        >
          <input aria-label="字幕の内容" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={1000} autoFocus />
          <button type="submit" className={s.confirm}>
            保存
          </button>
        </form>
      ) : (
        <p>{u.text}</p>
      )}
    </div>
  );
}

export function Transcript({ state, extracting, onAdd, onEdit }: TranscriptProps) {
  return (
    <section className={s.col} aria-labelledby="transcript-title">
      <div className={s.colHead}>
        <h2 id="transcript-title">会話</h2>
        <span className={s.count}>{state.utterances.length} 発話</span>
      </div>
      <div className={s.scroll} aria-live="polite">
        {state.utterances.length === 0 && <p className={s.empty}>打合せを始めると、会話が文字になって流れます。録音しない場合は、下のメモ入力で要点を打てます。</p>}
        {state.utterances.map((u) => (
          <Line key={`${u.id}:${u.text}`} u={u} onEdit={onEdit} />
        ))}
      </div>
      <InputDock onAdd={onAdd} />
      <div className={s.facts}>
        <h3>拾い上げた家族の事情 {extracting && <span className={s.thinking}>（整理中…）</span>}</h3>
        <div className={s.chips}>
          {state.circumstances.map((c) => (
            <span key={c.id} className={s.chip}>
              {c.text}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
