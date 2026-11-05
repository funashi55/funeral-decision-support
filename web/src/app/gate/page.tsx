import type { Metadata } from "next";
import { Suspense } from "react";
import s from "../../components/trial/trial.module.css";
import { safeNext } from "../../server/access";

export const metadata: Metadata = { title: "試用の入口｜葬儀の打合せ支援（仮称）", robots: { index: false, follow: false } };

async function GateForm({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null);
  const failed = params.error === "1";
  return (
    <form method="post" action="/api/gate" className={s.card}>
      <input type="hidden" name="next" value={next} />
      <label className={s.field}>
        合言葉
        <input className={s.input} name="code" type="password" autoComplete="off" required autoFocus />
      </label>
      {failed && <p className={s.error} role="alert">合言葉が違います。もう一度お試しください。</p>}
      <button className={s.button} type="submit">入る</button>
    </form>
  );
}

export default function GatePage({ searchParams }: PageProps<"/gate">) {
  return (
    <main className={s.page}>
      <div className={s.column}>
        <p className={s.eyebrow}>TRIAL</p>
        <h1 className={s.title}>葬儀の打合せ支援（仮称）<br />試用の入口</h1>
        <p className={s.lead}>お知らせした合言葉を入れてください。</p>
        <Suspense>
          <GateForm searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
