import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import s from "../../components/cases/cases.module.css";
import { SystemBar } from "../../components/system/SystemBar";
import { DEMO_CASE } from "../../engine/fixtures/demoCase";
import { store } from "../../server/store";

export const metadata: Metadata = { title: "ご家族の一覧｜葬儀の打合せ支援（仮称）", robots: { index: false, follow: false } };

const dateTime = (ms: number): string => new Date(ms).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

/** 登録した喪家（新しい順）と、架空のデモの家族 */
async function CaseList() {
  const cases = await store.listCases();
  return (
    <ul className={s.list} aria-label="ご家族">
      {cases.length === 0 && <li className={s.empty}>まだ登録したご家族はいません。お迎えの連絡が入ったら「新しいご家族を登録」から始めます。</li>}
      {cases.map((c) => (
        <li key={c.caseId}>
          <Link className={s.case} href={`/staff/${c.caseId}`}>
            <span>
              <span className={s.caseName}>{c.familyName}</span>
              <span className={s.caseMeta}>{dateTime(c.registeredAt)} に登録</span>
            </span>
            <span className={s.arrow} aria-hidden="true">
              →
            </span>
          </Link>
        </li>
      ))}
      <li>
        <Link className={s.case} href={`/staff/${DEMO_CASE.caseId}`}>
          <span>
            <span className={s.caseName}>
              {DEMO_CASE.familyName}
              <span className={s.tag}>デモ・架空</span>
            </span>
            <span className={s.caseMeta}>「▶ 打合せを再生」で、打合せの会話が流れます</span>
          </span>
          <span className={s.arrow} aria-hidden="true">
            →
          </span>
        </Link>
      </li>
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
            <div>
              <p className={s.eyebrow}>受付</p>
              <h1 className={s.title}>ご家族の一覧</h1>
              <p className={s.lead}>お迎えの連絡が入ったら、ご家族を登録して打合せを始めます。</p>
            </div>
            <Link className={s.primary} href="/staff/new">
              ＋ 新しいご家族を登録
            </Link>
          </div>
          <Suspense fallback={<p className={s.empty}>読み込んでいます…</p>}>
            <CaseList />
          </Suspense>
        </div>
      </main>
    </>
  );
}
