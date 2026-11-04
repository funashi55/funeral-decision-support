"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * ブラウザ標準の音声認識で打合せを聞き取る。確定した一文ごとに onFinal を呼ぶ。
 * 音声そのものは保存しない（ブラウザの中で文字にするだけ）。
 * 録音は担当者が家族の同意を確かめてから始める（同意の確認は画面側で行う）。
 */

interface SpeechRecognitionAlternativeLike {
  readonly transcript: string;
}
interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly 0: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { readonly error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionCtor = new () => SpeechRecognitionLike;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type SpeechStatus = "idle" | "listening" | "paused" | "unsupported" | "error";

export interface SpeechInput {
  readonly status: SpeechStatus;
  /** 確定前の聞き取り途中の文 */
  readonly interim: string;
  readonly error: string | null;
  readonly start: () => void;
  readonly pause: () => void;
}

const ERROR_LABEL: Record<string, string> = {
  "not-allowed": "マイクの使用が許可されていません。ブラウザの設定を確かめてください",
  "audio-capture": "マイクが見つかりません",
  network: "音声認識の通信に失敗しました",
};

export function useSpeechInput(onFinal: (text: string) => void): SpeechInput {
  const [status, setStatus] = useState<SpeechStatus>("idle");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const wanted = useRef(false);
  const finalRef = useRef(onFinal);
  useEffect(() => {
    finalRef.current = onFinal;
  }, [onFinal]);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      setStatus("unsupported");
      return;
    }
    const r = new Ctor();
    r.lang = "ja-JP";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let pending = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (!result) continue;
        const text = result[0].transcript.trim();
        if (result.isFinal) {
          if (text) finalRef.current(text);
        } else pending += text;
      }
      setInterim(pending);
    };
    r.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      wanted.current = false;
      setError(ERROR_LABEL[e.error] ?? "音声認識で問題が起きました");
      setStatus("error");
    };
    // 無音が続くと止まるので、担当者が止めていなければ聞き取りを続ける
    r.onend = () => {
      if (wanted.current) r.start();
    };
    recognition.current = r;
    wanted.current = true;
    setError(null);
    r.start();
    setStatus("listening");
  }, []);

  const pause = useCallback(() => {
    wanted.current = false;
    recognition.current?.stop();
    setInterim("");
    setStatus("paused");
  }, []);

  useEffect(
    () => () => {
      wanted.current = false;
      recognition.current?.stop();
    },
    [],
  );

  return { status, interim, error, start, pause };
}
