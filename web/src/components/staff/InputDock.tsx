"use client";
import { useCallback, useState } from "react";
import { useSpeechInput } from "../../client/useSpeechInput";
import type { Speaker } from "../../engine/case";
import s from "./staff.module.css";

export interface NewLine {
  readonly speaker: Speaker;
  readonly speakerLabel: string;
  readonly text: string;
}

const SPEAKERS: readonly { readonly speaker: Speaker; readonly label: string }[] = [
  { speaker: "chief_mourner", label: "喪主" },
  { speaker: "family", label: "ご家族" },
  { speaker: "staff", label: "担当者" },
];

type Mode = "memo" | "mic";

interface InputDockProps {
  readonly onAdd: (line: NewLine) => Promise<void>;
}

/**
 * 録音の代わりに要点を打つ「メモ入力」と、マイクでの聞き取り。どちらも以降の処理は同じ。
 * マイクはご家族の同意を確かめてから始める。音声は保存しない。
 */
export function InputDock({ onAdd }: InputDockProps) {
  const [mode, setMode] = useState<Mode>("memo");
  const [speakerIdx, setSpeakerIdx] = useState(0);
  const [text, setText] = useState("");
  const [consented, setConsented] = useState(false);
  const who = SPEAKERS[speakerIdx] ?? SPEAKERS[0]!;

  const addFinal = useCallback((t: string) => void onAdd({ speaker: who.speaker, speakerLabel: who.label, text: t }), [onAdd, who]);
  const speech = useSpeechInput(addFinal);

  const submit = async (): Promise<void> => {
    const t = text.trim();
    if (!t) return;
    await onAdd({ speaker: who.speaker, speakerLabel: who.label, text: t });
    setText("");
  };

  return (
    <div className={s.dock}>
      <div className={s.dockTabs} role="tablist" aria-label="入力の方法">
        <button type="button" role="tab" aria-selected={mode === "memo"} onClick={() => setMode("memo")}>
          メモ入力
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "mic"}
          onClick={() => {
            if (speech.status === "listening") speech.pause();
            setMode("mic");
          }}
        >
          マイクで聞き取る
        </button>
        <label className={s.dockWho}>
          話した人
          <select value={speakerIdx} onChange={(e) => setSpeakerIdx(Number(e.target.value))}>
            {SPEAKERS.map((sp, i) => (
              <option key={sp.speaker} value={i}>
                {sp.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {mode === "memo" && (
        <form
          className={s.memoForm}
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <input aria-label="発言の要点" placeholder="例：お寺は父の実家の菩提寺で、市外です" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} />
          <button type="submit" className={`${s.btn} ${s.btnPrimary}`} disabled={!text.trim()}>
            追加
          </button>
        </form>
      )}

      {mode === "mic" && !consented && (
        <div className={s.consent} role="group" aria-label="録音の同意">
          <p>聞き取りを始める前に、ご家族に次のことをお伝えし、同意をいただいてください。</p>
          <ul>
            <li>打合せの内容を文字にして、担当者の手元のメモにします</li>
            <li>音声そのものは保存しません</li>
            <li>いつでも止められます</li>
          </ul>
          <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={() => setConsented(true)}>
            ご家族の同意をいただいた
          </button>
        </div>
      )}

      {mode === "mic" && consented && (
        <div className={s.micRow}>
          {speech.status === "listening" ? (
            <button type="button" className={s.btn} onClick={speech.pause}>
              一時停止
            </button>
          ) : (
            <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={speech.start} disabled={speech.status === "unsupported"}>
              {speech.status === "paused" ? "聞き取りを再開" : "聞き取りを始める"}
            </button>
          )}
          <span className={s.count} aria-live="polite">
            {speech.status === "listening" && (speech.interim || "聞き取り中…")}
            {speech.status === "unsupported" && "このブラウザは音声認識に対応していません。メモ入力をお使いください"}
            {speech.error}
          </span>
        </div>
      )}
    </div>
  );
}
