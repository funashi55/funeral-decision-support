"use client";
import { useRef, useState } from "react";
import { useFamilyStream } from "../../client/useFamilyStream";
import type { FamilyView } from "../../engine/familyView";
import { Guide, type GuideStep } from "../guide/Guide";
import { ChatWidget } from "./ChatWidget";
import { DecidedList } from "./DecidedList";
import { RequestComposer, type ComposerDraft } from "./RequestComposer";
import { SentList } from "./SentList";
import { TaskList } from "./TaskList";
import s from "./family.module.css";

/** ご家族向けのガイド（自動では始めず、右上の「？」から） */
const FAMILY_GUIDE: readonly GuideStep[] = [
  { target: "decided", title: "決まったこと", body: "担当者と決めたことが残ります。変えたいときは、ここから担当者にお願いできます。" },
  { target: "upcoming", title: "これから決めること", body: "これから担当者と一緒に決める順番です。" },
  { target: "composer", title: "担当者に送る", body: "聞きたいこと・変えたいことを送れます。送っても、決まったことが勝手に変わることはありません。" },
  { target: "chat", title: "案内役に尋ねる", body: "決まったことの確認は、いつでも案内役（AI）に尋ねられます。" },
];

const EMPTY_DRAFT: ComposerDraft = { kind: "question", decisionId: null };

function Upcoming({ view }: { readonly view: FamilyView }) {
  return (
    <section className={s.section} aria-labelledby="upcoming-title" data-guide="upcoming">
      <div className={s.sectionHead}>
        <h2 id="upcoming-title">これから決めること</h2>
      </div>
      <ol className={s.upcoming}>
        {view.upcoming.map((u) => (
          <li key={u.id}>
            <span>{u.label}</span>
            {/* ご家族の画面では「今日のうちに」で急かさない。順番だけを示す */}
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
        <p className={s.eyebrow}>
          ご家族の窓口{view.demo && <span className={s.demoBadge}>デモ・架空のご家族</span>}
        </p>
        <h1 className={s.title}>{view.familyName}さま</h1>
        <p className={s.lead}>決めたことと、お願いしたいことは、ここにいつでも残っています。覚えておかなくて大丈夫です。</p>
        <p className={`${s.live} ${status === "open" ? s.liveOn : ""}`} role="status">
          {status === "open" ? "いつも最新の内容です" : "つなぎ直しています…"}
        </p>
      </header>

      <TaskList token={token} tasks={view.tasks ?? []} />
      <DecidedList decided={view.decided} onAskChange={askChange} />
      <Upcoming view={view} />
      {view.notes.length > 0 && (
        <section className={s.section} aria-labelledby="notes-title">
          <div className={s.sectionHead}>
            <h2 id="notes-title">検討メモ</h2>
          </div>
          <ul className={s.notesList}>
            {view.notes.map((n) => (
              <li key={n.id}>{n.text}</li>
            ))}
          </ul>
        </section>
      )}
      <RequestComposer ref={composerRef} token={token} decided={view.decided} draft={draft} onDraftChange={setDraft} onSent={() => setDraft(EMPTY_DRAFT)} />
      <SentList requests={view.requests} />

      <ChatWidget token={token} view={view} />
      <Guide steps={FAMILY_GUIDE} storageKey="family" label="窓口" autoStart={false} />

      <footer className={s.footer}>
        この画面は担当者からお渡ししたリンクでだけ開けます。リンクはご家族の中でだけ共有してください。
      </footer>
    </main>
  );
}
