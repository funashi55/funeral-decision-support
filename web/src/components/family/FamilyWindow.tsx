"use client";
import { useRef, useState } from "react";
import { useFamilyStream } from "../../client/useFamilyStream";
import type { FamilyView } from "../../engine/familyView";
import { DecidedList } from "./DecidedList";
import { RequestComposer, type ComposerDraft } from "./RequestComposer";
import { SentList } from "./SentList";
import s from "./family.module.css";

const EMPTY_DRAFT: ComposerDraft = { kind: "question", decisionId: null };

function Upcoming({ view }: { readonly view: FamilyView }) {
  return (
    <section className={s.section} aria-labelledby="upcoming-title">
      <div className={s.sectionHead}>
        <h2 id="upcoming-title">これから決めること</h2>
      </div>
      <ol className={s.upcoming}>
        {view.upcoming.map((u) => (
          <li key={u.id}>
            <span>{u.label}</span>
            {u.today ? <span className={s.todayTag}>今日のうちに</span> : <span className={s.laterTag}>あとで</span>}
          </li>
        ))}
      </ol>
      {view.moreUpcoming > 0 && <p className={s.note}>ほかに {view.moreUpcoming} 件あります。順番に、担当者がご一緒に確かめます。</p>}
    </section>
  );
}

export function FamilyWindow({ token }: { readonly token: string }) {
  const { view, status } = useFamilyStream(token);
  const [draft, setDraft] = useState<ComposerDraft>(EMPTY_DRAFT);
  const composerRef = useRef<HTMLElement>(null);

  if (status === "not_found") {
    return (
      <main className={s.page}>
        <p className={s.notice}>このリンクは使えません。お手数ですが、担当者にお問い合わせください。</p>
      </main>
    );
  }
  if (!view) return <main className={s.page}><p className={s.note}>読み込んでいます…</p></main>;

  const askChange = (decisionId: string): void => {
    setDraft({ kind: "change", decisionId });
    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className={s.page}>
      <header className={s.hero}>
        <p className={s.eyebrow}>ご家族の窓口</p>
        <h1 className={s.title}>{view.familyName}さま</h1>
        <p className={s.lead}>担当者と決めたことは、ここにいつでも残っています。急いで決めなくて大丈夫です。気になることは、いつでも担当者にお送りください。</p>
        <p className={`${s.live} ${status === "open" ? s.liveOn : ""}`} role="status">
          {status === "open" ? "担当者の画面とつながっています" : "つなぎ直しています…"}
        </p>
      </header>

      <DecidedList decided={view.decided} onAskChange={askChange} />
      <Upcoming view={view} />
      <RequestComposer ref={composerRef} token={token} decided={view.decided} draft={draft} onDraftChange={setDraft} onSent={() => setDraft(EMPTY_DRAFT)} />
      <SentList requests={view.requests} />

      <footer className={s.footer}>
        この画面は担当者からお渡ししたリンクでだけ開けます。リンクはご家族の中でだけ共有してください。
      </footer>
    </main>
  );
}
