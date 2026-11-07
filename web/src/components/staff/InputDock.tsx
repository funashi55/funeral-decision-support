"use client";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useSpeechInput } from "../../client/useSpeechInput";
import type { Speaker } from "../../engine/case";
import s from "./staff.module.css";

/** 話した人は送った先で自動で聞き分ける（auto）。デモの台本など、わかっているときは指定してもよい */
export interface NewLine {
  readonly speaker: Speaker | "auto";
  readonly speakerLabel?: string;
  readonly text: string;
}

const MAX_ROWS_PX = 140;

interface InputDockProps {
  readonly onAdd: (line: NewLine) => Promise<void>;
}

/**
 * 要点を打つメモ入力と、マイクでの聞き取り。どちらも以降の処理は同じ。
 * Enter で送り、Shift+Enter で改行する。マイクはご家族の同意を確かめてから始める。音声は保存しない。
 */
export function InputDock({ onAdd }: InputDockProps) {
  const [text, setText] = useState("");
  const [micOpen, setMicOpen] = useState(false);
  const [consented, setConsented] = useState(false);
  const [sending, setSending] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  const addFinal = useCallback((t: string) => void onAdd({ speaker: "auto", text: t }), [onAdd]);
  const speech = useSpeechInput(addFinal);

  // 打った分だけ入力欄を伸ばす（上限を超えたら中でスクロール）
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_ROWS_PX)}px`;
  }, [text]);

  const submit = async (): Promise<void> => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    setText("");
    try {
      await onAdd({ speaker: "auto", text: t });
    } finally {
      setSending(false);
      area.current?.focus();
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  };

  const toggleMic = (): void => {
    if (speech.status === "listening") speech.pause();
    setMicOpen((o) => !o);
  };

  return (
    <div className={s.dock} data-guide="composer">
      {micOpen && !consented && (
        <div className={s.consent} role="group" aria-label="録音の同意">
          <p>
            聞き取りを始める前に、ご家族に次のことをお伝えし、同意をいただいてください。
          </p>
          <ul>
            <li>打合せの内容を文字にして、担当者の手元のメモにします</li>
            <li>音声そのものは保存しません</li>
            <li>いつでも止められます</li>
          </ul>
          <button
            type="button"
            className={`${s.btn} ${s.btnPrimary}`}
            onClick={() => setConsented(true)}
          >
            ご家族の同意をいただいた
          </button>
        </div>
      )}
      {micOpen && consented && (
        <div className={s.micRow}>
          {speech.status === "listening" ? (
            <button
              type="button"
              className={`${s.btn} ${s.btnRec}`}
              onClick={speech.pause}
            >
              <span className={s.recDot} aria-hidden="true" />
              一時停止
            </button>
          ) : (
            <button
              type="button"
              className={`${s.btn} ${s.btnPrimary}`}
              onClick={speech.start}
              disabled={speech.status === "unsupported"}
            >
              {speech.status === "paused"
                ? "聞き取りを再開"
                : "聞き取りを始める"}
            </button>
          )}
          <span className={s.count} aria-live="polite">
            {speech.status === "listening" && (speech.interim || "聞き取り中…")}
            {speech.status === "unsupported" &&
              "このブラウザは音声認識に対応していません。メモで打ってください"}
            {speech.error}
          </span>
        </div>
      )}

      <form
        className={s.composer}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className={s.composerRow}>
          <textarea
            ref={area}
            rows={1}
            aria-label="発言の要点"
            placeholder="話したこと（例：母はお風呂が好きでした）"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            maxLength={1000}
          />
          <div className={s.composerActions}>
            <button
              type="button"
              className={`${s.iconBtn} ${micOpen ? s.iconBtnOn : ""}`}
              onClick={toggleMic}
              aria-pressed={micOpen}
              aria-label="マイクで聞き取る"
              title="マイクで聞き取る"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <rect x="9" y="3" width="6" height="12" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
              </svg>
            </button>
            <button
              type="submit"
              className={s.sendBtn}
              disabled={!text.trim() || sending}
              aria-label="追加"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>
      </form>
      <p className={s.composerHint}>Enter で追加・Shift+Enter で改行</p>
    </div>
  );
}
