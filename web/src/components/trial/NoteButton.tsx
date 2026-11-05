"use client";

import { useState } from "react";
import s from "./trial.module.css";

const NAME_KEY = "trial-note-name";

/** 試用中だけ出す「感想を送る」ボタン。どの画面のどこで書いたかも一緒に送る */
export function NoteButton() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const send = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setStatus("sending");
    try {
      window.localStorage.setItem(NAME_KEY, name);
      // ご家族の窓口の合言葉は送らない（どの画面かだけわかればよい）
      const pathname = window.location.pathname;
      const page = pathname.startsWith("/f/") ? "/f/（ご家族の窓口）" : pathname;
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, page, text }),
      });
      const body = (await res.json()) as { success: boolean };
      if (!body.success) throw new Error();
      setText("");
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  };

  return (
    <>
      {open && (
        <form className={s.notePanel} onSubmit={(e) => void send(e)} aria-label="感想を送る">
          <label className={s.field}>
            お名前（任意）
            <input className={s.input} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className={s.field}>
            この画面で気づいたこと
            <textarea
              className={s.textarea}
              value={text}
              maxLength={2000}
              required
              placeholder="例：ここは現場ではこう言う／この推奨は違う／わかりにくい"
              onChange={(e) => {
                setText(e.target.value);
                setStatus("idle");
              }}
            />
          </label>
          {status === "sent" && <p className={s.done} role="status">受け取りました。ありがとうございます。</p>}
          {status === "error" && <p className={s.error} role="alert">送れませんでした。もう一度お試しください。</p>}
          <button className={s.button} type="submit" disabled={status === "sending" || text.trim() === ""}>
            送る
          </button>
        </form>
      )}
      <button className={s.noteFab} type="button" aria-expanded={open} onClick={() => {
          if (!open && name === "") setName(window.localStorage.getItem(NAME_KEY) ?? "");
          setOpen((v) => !v);
        }}>
        {open ? "閉じる" : "感想を送る"}
      </button>
    </>
  );
}
