import type { Metadata } from "next";
import { PrintButton } from "../../../../../components/paperwork/PrintButton";
import s from "../../../../../components/paperwork/sheet.module.css";
import r from "../../../../../components/records/record.module.css";
import type { MeetingReport } from "../../../../../engine/report";
import { reportStore } from "../../../../../server/reportStore";

export const metadata: Metadata = { title: "打合せの記録｜sou-buddy", robots: { index: false, follow: false } };

const jst = (ms: number): string =>
  new Date(ms).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });

function Bullets({ title, items }: { readonly title: string; readonly items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <section className={r.section}>
      <h2>{title}</h2>
      <ul className={r.list}>
        {items.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </section>
  );
}

function Decided({ report }: { readonly report: MeetingReport }) {
  return (
    <section className={r.section}>
      <h2>決まったこと</h2>
      {report.decided.length + report.candidates.length === 0 ? (
        <p className={r.empty}>まだありません</p>
      ) : (
        <table className={r.table}>
          <tbody>
            {report.decided.map((d) => (
              <tr key={d.label}>
                <th>{d.label}</th>
                <td>{d.value}</td>
              </tr>
            ))}
            {report.candidates.map((d) => (
              <tr key={d.label} className={r.cand}>
                <th>{d.label}</th>
                <td>{d.value}（候補・未確定）</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** 打合せの記録：その回の要約・決まったこと・清書した会話。印刷・PDF に保存できる */
export default async function RecordPage({ params }: PageProps<"/staff/[caseId]/records/[reportId]">) {
  const { caseId, reportId } = await params;
  const report = (await reportStore.list(caseId)).find((x) => x.id === reportId);
  if (!report) {
    return (
      <main className={s.page} data-print-page>
        <p className={s.bar}>この記録は見つかりません。</p>
      </main>
    );
  }
  const edited = report.transcript.filter((l) => l.text !== l.original).length;
  return (
    <main className={s.page} data-print-page>
      <div className={s.bar}>
        <span>
          {report.familyName}・第{report.number}回の打合せの記録
        </span>
        <PrintButton />
      </div>
      <article className={[s.sheet, r.doc].join(" ")} aria-label="打合せの記録">
        <header className={r.head}>
          <h1 className={r.title}>
            {report.familyName}　第{report.number}回 打合せの記録
          </h1>
          <p className={r.meta}>
            {jst(report.createdAt)}
            <br />
            担当者　{report.staffName ?? "＿＿＿＿＿＿"}
          </p>
        </header>

        <section className={r.section}>
          <h2>要約</h2>
          <p className={r.overview}>{report.overview}</p>
        </section>
        <Bullets title="ご家族が大事にしたいこと" items={report.familyVoice.map((v) => v.text)} />
        <Decided report={report} />
        <Bullets title="まだ決まっていないこと" items={report.pending} />
        <Bullets title="次にすること" items={report.nextSteps} />

        <section className={r.section}>
          <h2>会話（清書）</h2>
          <p className={r.note}>文字起こしの誤字・言いよどみを整えています（{edited}か所）。画面では元の文字起こしも並べています。</p>
          <div className={r.lines}>
            {report.transcript.map((l) => (
              <p key={l.id} className={l.speaker === "staff" ? [r.line, r.staff].join(" ") : r.line}>
                <span className={r.who}>{l.speakerLabel}</span>
                <span>
                  {l.text}
                  {l.text !== l.original && <small className={r.edited}>元：{l.original}</small>}
                </span>
              </p>
            ))}
          </div>
        </section>
      </article>
    </main>
  );
}
