import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CasesGuide } from "../../components/cases/CasesGuide";
import s from "../../components/cases/cases.module.css";
import { SystemBar } from "../../components/system/SystemBar";
import { DECISIONS } from "../../domain/decisions";
import type { CaseState } from "../../engine/case";
import { DEMO_CASE } from "../../engine/fixtures/demoCase";
import { store } from "../../server/store";

export const metadata: Metadata = { title: "ご家族｜葬儀の打合せ支援（仮称）", robots: { index: false, follow: false } };

/** 一覧に並べる数（多いときは新しい順にここまで） */
const LIST_MAX = 30;

const dateTime = (ms: number): string => new Date(ms).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

function CaseCard({ state, href, meta, demo }: { readonly state: CaseState | undefined; readonly href: string; readonly meta: string; readonly demo?: boolean }) {
  const name = state?.familyName ?? "";
  const decided = state ? DECISIONS.filter((d) => state.decisions[d.id]?.status === "confirmed").length : 0;
  const talk = state?.utterances.length ?? 0;
  const requests = state?.requests.filter((r) => r.status === "open").length ?? 0;
  return (
    <Link className={s.case} href={href} data-guide={demo ? "demo-card" : "case-card"}>
      <span className={s.avatar} aria-hidden="true">
        {name.slice(0, 1)}
      </span>
      <span className={s.caseBody}>
        <span className={s.caseName}>
          {name}
          {demo && <span className={s.tag}>デモ</span>}
        </span>
        <span className={s.caseMeta}>{meta}</span>
        <span className={s.progress} aria-label={`決まった ${decided} / ${DECISIONS.length}`}>
          <i style={{ width: `${(decided / DECISIONS.length) * 100}%` }} />
        </span>
      </span>
      <span className={s.stats}>
        <span title="決まった項目">
          <Icon d="M20 6 9 17l-5-5" />
          {decided}
        </span>
        <span title="会話の発言">
          <Icon d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12Z" />
          {talk}
        </span>
        {requests > 0 && (
          <span className={s.statWarn} title="ご家族からの未対応">
            <Icon d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
            {requests}
          </span>
        )}
      </span>
    </Link>
  );
}

function Icon({ d }: { readonly d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

async function CaseList() {
  const cases = (await store.listCases()).slice(0, LIST_MAX);
  const states = await Promise.all(cases.map((c) => store.get(c.caseId)));
  const demo = await store.get(DEMO_CASE.caseId);
  return (
    <ul className={s.list} aria-label="ご家族">
      {cases.map((c, i) => (
        <li key={c.caseId}>
          <CaseCard state={states[i] ?? { ...DEMO_CASE, familyName: c.familyName, decisions: {}, utterances: [] }} href={`/staff/${c.caseId}`} meta={`${dateTime(c.registeredAt)} 登録`} />
        </li>
      ))}
      <li>
        <CaseCard state={demo} href={`/staff/${DEMO_CASE.caseId}`} meta="架空のご家族" demo />
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
