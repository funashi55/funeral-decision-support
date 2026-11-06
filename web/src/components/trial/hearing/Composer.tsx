"use client";
import { useCallback, useState } from "react";
import { useSpeechInput } from "../../../client/useSpeechInput";
import { TURN_TEXT_MAX } from "../../../engine/hearing";
import type { InputMode } from "./hearingDraft";
import s from "../trial.module.css";
import h from "./hearing.module.css";

interface ComposerProps {
  readonly mode: InputMode;
  readonly busy: boolean;
  readonly placeholder: string;
  readonly onSend: (text: string) => void;
  /** 入力欄の下に並べる操作（打合せを終える など） */
  readonly children?: React.ReactNode;
}

/**
 * 声で話すか、文字で打つか。声のときも、文字になったものを見て直してから送る。
 * 音声は保存しない（ブラウザの中で文字にするだけ）。
 */
export function Composer({ mode, busy, placeholder, onSend, children }: ComposerProps) {
  const [text, setText] = useState("");
  const append = useCallback((t: string) => setText((prev) => (prev ? `${prev}${t}` : t).slice(0, TURN_TEXT_MAX)), []);
  const speech = useSpeechInput(append);
  const listening = speech.status === "listening";

  const send = (): void => {
    const value = text.trim();
    if (!value || busy) return;
    if (listening) speech.pause();
    onSend(value);
    setText("");
  };

  return (
    <div className={h.composer}>
      <div className={h.composerRow}>
        {mode === "voice" && (
          <button
            type="button"
            className={h.mic}
            aria-pressed={listening}
            onClick={listening ? speech.pause : speech.start}
            aria-label={listening ? "聞き取りを止める" : "話して入力する"}
          >
            {listening ? "止める" : "話す"}
          </button>
        )}
        <textarea
          value={text}
          maxLength={TURN_TEXT_MAX}
          placeholder={mode === "voice" ? "「話す」を押して話してください" : placeholder}
          aria-label="あなたの発言"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
        />
      </div>
      {mode === "voice" && (
        <p className={h.interim} aria-live="polite">
          {speech.status === "unsupported"
            ? "このブラウザでは声の入力が使えません。上の切り替えで「チャット」にしてください（Chrome なら使えます）"
            : (speech.error ?? speech.interim)}
        </p>
      )}
      <div className={h.actions}>
        <span className={h.hint}>{mode === "chat" ? "Enter で送る・Shift+Enter で改行" : "話し終えたら「送る」を押してください"}</span>
        <span style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          {children}
          <button type="button" className={s.button} onClick={send} disabled={busy || !text.trim()}>
            {busy ? "待っています…" : "送る"}
          </button>
        </span>
      </div>
    </div>
  );
}

/** 声のときは家族や聞き手の言葉を読み上げる（ブラウザの読み上げ。音声は保存しない） */
export function speak(text: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ja-JP";
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
}
