"use client";
import { useState } from "react";
import { api } from "../../client/api";
import { CHAT_TEXT_MAX } from "../../engine/familyChat";
import type { FamilyView } from "../../engine/familyView";
import s from "./family.module.css";

interface AskBoxProps {
  readonly token: string;
  readonly view: FamilyView;
}

/**
 * 窓口の案内役に、決まったことを尋ねる。案内役は記録を読む・メモを残す・担当者に回すことしかできず、
 * 決定を変えたり、どれが良いかを勧めたりはしない。
 */
export function AskBox({ token, view }: AskBoxProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (sending || !text.trim()) return;
    setSending(true);
    setError(null);
    try {
      await api.familyChat(token, text);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "お返事できませんでした");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className={s.section} aria-labelledby="ask-title">
      <div className={s.sectionHead}>
        <h2 id="ask-title">窓口に尋ねる</h2>
      </div>
      <p className={s.note} style={{ marginTop: 0 }}>
        決まったことを確かめたり、考えたいことをメモに残したりできます。変えたいことや、担当者にしか分からないことは、担当者にお伝えします。
      </p>
      {view.chat.length > 0 && (
        <ol className={s.chat} aria-live="polite">
          {view.chat.map((t) => (
            <li key={t.id} className={t.role === "family" ? s.chatFamily : s.chatGuide}>
              <p>{t.text}</p>
              {t.handedOff && <small>担当者にお伝えしました</small>}
            </li>
          ))}
        </ol>
      )}
      <form className={s.askForm} onSubmit={(e) => void submit(e)}>
        <label className={s.field}>
          <span className="sr-only">尋ねたいこと</span>
          <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="例：火葬は何時からでしたか" maxLength={CHAT_TEXT_MAX} />
        </label>
        <button type="submit" className={s.submit} disabled={sending || !text.trim()}>
          {sending ? "お返事を考えています…" : "尋ねる"}
        </button>
        {error && (
          <p className={s.error} role="alert">
            {error}
          </p>
        )}
      </form>
      {view.notes.length > 0 && (
        <div className={s.notes}>
          <h3>検討メモ</h3>
          <ul>
            {view.notes.map((n) => (
              <li key={n.id}>{n.text}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
