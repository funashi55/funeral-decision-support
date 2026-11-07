import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CaseCard } from "../../components/cases/CaseCard";
import { CasesGuide } from "../../components/cases/CasesGuide";
import s from "../../components/cases/cases.module.css";
import { SystemBar } from "../../components/system/SystemBar";
import { store } from "../../server/store";

export const metadata: Metadata = { title: "ご家族｜葬儀の打合せ支援（仮称）", robots: { index: false, follow: false } };

/** 一覧に並べる数（多いときは新しい順にここまで） */
const LIST_MAX = 30;

const dateTime = (ms: number): string => new Date(ms).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

/** 本番の案件（登録した喪家）だけを並べる。デモ（架空のご家族）は /demo に分ける */
async function CaseList() {
  const cases = (await store.listCases()).slice(0, LIST_MAX);
  const states = await Promise.all(cases.map((c) => store.get(c.caseId)));
  if (cases.length === 0) {
    return (
      <p className={s.empty}>
        まだ登録したご家族はいません。お迎えの連絡が入ったら「登録」から始めます。
        <br />
        架空のご家族で試すときは <Link href="/demo">デモ</Link> を開いてください。
      </p>
    );
  }
  return (
    <ul className={s.list} aria-label="ご家族">
      {cases.map((c, i) => (
        <li key={c.caseId}>
          <CaseCard state={states[i]} name={c.familyName} href={`/staff/${encodeURIComponent(c.caseId)}`} meta={`${dateTime(c.registeredAt)} 登録`} />
        </li>
      ))}
    </ul>
  );
}

export default function CasesPage() {
  return (
    <>
      <SystemBar current="families" />
      <main className={s.page}>
        <div className={s.column}>
          <div className={s.head}>
            <h1 className={s.title}>ご家族</h1>
            <Link className={s.primary} href="/staff/new" data-guide="register">
              <span aria-hidden="true">＋</span> 登録
            </Link>
          </div>
          <Suspense fallback={<p className={s.empty}>読み込んでいます…</p>}>
            <CaseList />
          </Suspense>
        </div>
      </main>
      <CasesGuide />
    </>
  );
}
