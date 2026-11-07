"use client";
import { useEffect, useRef, useState } from "react";
import type { CaseState, Utterance } from "../../engine/case";
import { InputDock, type NewLine } from "./InputDock";
import s from "./staff.module.css";

interface TranscriptProps {
  readonly state: CaseState;
  readonly extracting: boolean;
  readonly onAdd: (line: NewLine) => Promise<void>;
  readonly onEdit: (utteranceId: string, text: string) => Promise<void>;
  /** 自動の聞き分けを直す（担当者 ↔ ご遺族） */
  readonly onSwapSpeaker: (utteranceId: string, speaker: "staff" | "family") => Promise<void>;
}

const mmss = (sec: number): string => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

function Line({ u, onEdit, onSwapSpeaker }: { readonly u: Utterance; readonly onEdit: TranscriptProps["onEdit"]; readonly onSwapSpeaker: TranscriptProps["onSwapSpeaker"] }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(u.text);
  const isStaff = u.speaker === "staff";
  return (
    <div className={`${s.utt} ${isStaff ? s.uttStaff : ""}`} data-testid={`utt-${u.id}`}>
      <span className={s.uttWho}>
        <button
          type="button"
          className={s.uttSpeaker}
          onClick={() => void onSwapSpeaker(u.id, isStaff ? "family" : "staff")}
          title={`押すと「${isStaff ? "ご遺族" : "担当者"}」に入れ替わります`}
          aria-label={`${u.id}の話した人を${isStaff ? "ご遺族" : "担当者"}に入れ替える`}
        >
          {u.speakerLabel}
          {u.speakerBy && u.speakerBy !== "manual" && <small>自動</small>}
        </button>
        <span>{mmss(u.at)}</span>
        {!editing && (
          <button type="button" className={s.uttEdit} onClick={() => setEditing(true)} aria-label={`${u.id}の字幕を直す`}>
            直す
          </button>
        )}
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
        <p className={s.bubble}>{u.text}</p>
      )}
    </div>
  );
}

export function Transcript({ state, extracting, onAdd, onEdit, onSwapSpeaker }: TranscriptProps) {
  const end = useRef<HTMLDivElement>(null);
  const count = state.utterances.length;
  // 新しい発言が届いたら、いちばん下まで送る
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [count]);

  return (
    <section className={s.col} aria-labelledby="transcript-title">
      <div className={s.colHead}>
        <h2 id="transcript-title">会話</h2>
        <span className={s.count}>{count} 発話</span>
      </div>
      <div className={s.facts} aria-live="polite">
        <h3>
          わかったこと
          {state.circumstances.length > 0 && <span className={s.factsCount}>{state.circumstances.length}</span>}
          {extracting && <span className={s.thinking}>整理中</span>}
        </h3>
        {state.circumstances.length === 0 ? (
          <p className={s.factsEmpty}>ご遺族の言葉から、家族の事情をここに拾い上げます</p>
        ) : (
          <ul className={s.factList}>
            {/* 新しくわかったことを上に出す（スクロールしなくても目に入るように） */}
            {[...state.circumstances].reverse().map((c) => (
              <li key={c.id} className={s.fact}>
                {c.text}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={s.scroll} aria-live="polite">
        {count === 0 && (
          <div className={s.emptyState}>
            <p className={s.emptyTitle}>まだ会話がありません</p>
            <p>上の「▶ 打合せを再生」でデモが始まります。録音しないときは、下の欄にご遺族の言葉を打ってください。</p>
          </div>
        )}
        {state.utterances.map((u) => (
          <Line key={`${u.id}:${u.text}:${u.speaker}`} u={u} onEdit={onEdit} onSwapSpeaker={onSwapSpeaker} />
        ))}
        <div ref={end} />
      </div>
      <InputDock onAdd={onAdd} />
    </section>
  );
}
