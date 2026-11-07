"use client";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { api } from "../../client/api";
import { CHAT_TEXT_MAX } from "../../engine/familyChat";
import type { FamilyView } from "../../engine/familyView";
import s from "./chat.module.css";

interface ChatWidgetProps {
  readonly token: string;
  readonly view: FamilyView;
}

/** 最初に出す、尋ね方の例（押すとそのまま送る） */
const SUGGESTIONS = ["決まったことを教えてください", "火葬は何時からでしたか", "担当者に伝えたいことがあります"] as const;
const MAX_INPUT_PX = 120;

/**
 * 窓口の案内役（AI）とのチャット。画面の左下のボタンで開く。
 * 案内役は記録を読む・メモを残す・担当者に回すことしかできず、決定を変えたり、どれが良いかを勧めたりはしない。
 */
export function ChatWidget({ token, view }: ChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seen, setSeen] = useState(view.chat.length);
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);

  const unread = open ? 0 : view.chat.slice(seen).filter((t) => t.role === "assistant").length;

  // 新しい言葉が出たら、いちばん下まで送る
  useEffect(() => {
    if (open) end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [open, view.chat.length, pending]);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  // 打った分だけ入力欄を伸ばす
  useLayoutEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_PX)}px`;
  }, [text, open]);

  // 閉じたときまでに届いたお返事は、読んだことにする
  const close = (): void => {
    setSeen(view.chat.length);
    setOpen(false);
    launcher.current?.focus();
  };

  const send = async (raw: string): Promise<void> => {
    const t = raw.trim();
    if (!t || pending) return;
    setPending(t);
    setText("");
    setError(null);
    try {
      await api.familyChat(token, t);
    } catch (err) {
      setError(err instanceof Error ? err.message : "お返事できませんでした");
      setText(t);
    } finally {
      setPending(null);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send(text);
    }
  };

  return (
    <>
      {open && (
        <section
          className={s.panel}
          role="dialog"
          aria-modal="false"
          aria-labelledby="chat-title"
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
          }}
        >
          <header className={s.head}>
            <span className={s.avatar} aria-hidden="true">
              <ChatIcon />
            </span>
            <div className={s.headText}>
              <h2 id="chat-title">窓口の案内役</h2>
              <p>機械（AI）がお答えします。担当者には人がお返事します</p>
            </div>
            <button type="button" className={s.close} onClick={close} aria-label="チャットを閉じる">
              ×
            </button>
          </header>

          <div className={s.body} aria-live="polite">
            <div className={`${s.msg} ${s.guide}`}>
              <p>
                {view.familyName}さま、窓口の案内役です。決まったことを確かめたり、考えたいことをメモに残したりできます。変えたいことや、担当者にしか分からないことは、担当者にお伝えします。夜のあいだに送られたものは、翌朝以降にお返事することがあります。
              </p>
            </div>
            {view.chat.map((t) => (
              <div key={t.id} className={`${s.msg} ${t.role === "family" ? s.mine : s.guide}`}>
                <p>{t.text}</p>
                {t.handedOff && <small>担当者にお伝えしました</small>}
              </div>
            ))}
            {pending && (
              <>
                <div className={`${s.msg} ${s.mine}`}>
                  <p>{pending}</p>
                </div>
                <div className={`${s.msg} ${s.guide} ${s.typing}`} aria-label="お返事を考えています">
                  <span />
                  <span />
                  <span />
                </div>
              </>
            )}
            {view.chat.length === 0 && !pending && (
              <div className={s.suggest}>
                {SUGGESTIONS.map((q) => (
                  <button key={q} type="button" onClick={() => void send(q)}>
                    {q}
                  </button>
                ))}
              </div>
            )}
            {error && (
              <p className={s.error} role="alert">
                {error}
              </p>
            )}
            <div ref={end} />
          </div>

          <form
            className={s.composer}
            onSubmit={(e) => {
              e.preventDefault();
              void send(text);
            }}
          >
            <textarea
              ref={input}
              rows={1}
              aria-label="尋ねたいこと"
              placeholder="尋ねたいことを入力"
              value={text}
              maxLength={CHAT_TEXT_MAX}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <button type="submit" className={s.send} disabled={!text.trim() || pending !== null} aria-label="尋ねる">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </form>
          <p className={s.foot}>案内役は決まったことを変えたり、どれが良いかを勧めたりはしません。</p>
        </section>
      )}

      <button
        ref={launcher}
        type="button"
        data-guide="chat"
        className={`${s.launcher} ${open ? s.launcherOpen : ""}`}
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-label={open ? "チャットを閉じる" : "窓口の案内役に尋ねる"}
      >
        {open ? <span aria-hidden="true">×</span> : <ChatIcon />}
        {!open && <span className={s.launcherLabel}>尋ねる</span>}
        {unread > 0 && (
          <span className={s.badge} aria-label={`新しいお返事 ${unread} 件`}>
            {unread}
          </span>
        )}
      </button>
    </>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12Z" />
      <path d="M8.5 11h.01M12 11h.01M15.5 11h.01" />
    </svg>
  );
}
