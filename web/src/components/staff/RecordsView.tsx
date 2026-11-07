"use client";
import { caseHref } from "../../domain/caseMode";
import type { MeetingReport } from "../../engine/report";
import c from "./console.module.css";
import b from "./records.module.css";

interface RecordsViewProps {
  readonly caseId: string;
  readonly reports: readonly MeetingReport[] | null;
  readonly ending: boolean;
  readonly canEnd: boolean;
  readonly onEnd: () => void;
}

const jst = (ms: number): string => new Date(ms).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

/** 打合せの記録：回ごとの要約と、清書した会話へのリンク（新しい回を上に） */
export function RecordsView({ caseId, reports, ending, canEnd, onEnd }: RecordsViewProps) {
  const list = [...(reports ?? [])].reverse();
  return (
    <div className={b.wrap} data-testid="records">
      <div className={b.head}>
        <h1 className={c.viewTitle}>打合せの記録</h1>
        <button type="button" className={b.end} onClick={onEnd} disabled={ending || !canEnd}>
          {ending ? "記録を作っています…" : "打合せを終えて記録する"}
        </button>
      </div>
      {ending && (
        <div className={b.skeleton} aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      )}
      {reports !== null && list.length === 0 && !ending && <p className={c.quiet}>まだ記録はありません。</p>}
      <ol className={b.list}>
        {list.map((r) => (
          <li key={r.id} className={b.item} data-testid={`record-${r.number}`}>
            <div className={b.itemHead}>
              <b>第{r.number}回</b>
              <span className={b.when}>{jst(r.createdAt)}</span>
              <span className={b.count}>{r.transcript.length}発言</span>
              <a className={b.open} href={caseHref(caseId, ["records", r.id].join("/"))} target="_blank" rel="noopener">
                清書と記録を開く
              </a>
            </div>
            <p className={b.overview}>{r.overview}</p>
            {r.nextSteps.length > 0 && (
              <ul className={b.next}>
                {r.nextSteps.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
