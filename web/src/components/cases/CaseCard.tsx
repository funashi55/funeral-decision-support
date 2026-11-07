import Link from "next/link";
import { DECISIONS } from "../../domain/decisions";
import type { CaseState } from "../../engine/case";
import s from "./cases.module.css";

/** 施行一覧・デモの入口に並べる1件 */
export function CaseCard({ state, name: fallbackName, href, meta, demo }: { readonly state: CaseState | undefined; readonly name?: string; readonly href: string; readonly meta: string; readonly demo?: boolean }) {
  const name = state?.familyName ?? fallbackName ?? "";
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
