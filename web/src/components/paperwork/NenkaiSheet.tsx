"use client";
import { useState } from "react";
import { buildNenkai, formatJa, type NenkaiRow } from "../../domain/nenkai";
import s from "./sheet.module.css";

/** ブラウザの中だけで使う今日の日付（YYYY-MM-DD・日本時間） */
const todayJst = (): string => new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);

function Rows({ rows }: { readonly rows: readonly NenkaiRow[] }) {
  return (
    <>
      {rows.map((r) => {
        const f = formatJa(r.date);
        return (
          <tr key={r.name}>
            <td>
              {r.name}
              {r.alias ? `（${r.alias}）` : ""}
            </td>
            <td>{f.western}</td>
            <td>{f.japanese}</td>
          </tr>
        );
      })}
    </>
  );
}

/**
 * 年回表（中陰月日表）。亡くなった日を入れると、法要の日付を数えて A4 で印刷できる。
 * 入れた日付は保存しない（このページを閉じると消える）
 */
export function NenkaiSheet({ familyName }: { readonly familyName: string }) {
  const [deathDate, setDeathDate] = useState(todayJst);
  let table: ReturnType<typeof buildNenkai> | null = null;
  try {
    table = buildNenkai(deathDate);
  } catch {
    table = null;
  }

  return (
    <>
      <div className={s.bar}>
        <label>
          亡くなった日{" "}
          <input type="date" value={deathDate} onChange={(e) => setDeathDate(e.target.value)} aria-label="亡くなった日" />
        </label>
        <button type="button" className={s.print} onClick={() => window.print()} disabled={!table}>
          印刷する／PDF に保存する
        </button>
      </div>
      {table ? (
        <article className={s.sheet} aria-label="年回表">
          <div className={s.head}>
            <h1 className={s.title}>年回表</h1>
          </div>
          <div className={s.to}>{familyName}　様</div>
          <p className={s.note}>ご逝去日：{formatJa(table.deathDate).western}（{formatJa(table.deathDate).japanese}）</p>
          <table className={s.items}>
            <thead>
              <tr>
                <th scope="col">中陰の法要</th>
                <th scope="col">日付</th>
                <th scope="col">和暦</th>
              </tr>
            </thead>
            <tbody>
              <Rows rows={table.chuin} />
            </tbody>
          </table>
          <table className={s.items}>
            <thead>
              <tr>
                <th scope="col">年忌法要</th>
                <th scope="col">日付</th>
                <th scope="col">和暦</th>
              </tr>
            </thead>
            <tbody>
              <Rows rows={table.nenki} />
            </tbody>
          </table>
          <div className={s.foot}>
            <p>
              ご逝去日を1日目として数えています。地域やお寺によって数え方が異なることがあります。法要の日取りは、お寺さまとご相談ください。
              {table.spansThreeMonths && " 四十九日が3つの月にまたがるため、地域によっては三十五日で忌明けとすることがあります。"}
            </p>
          </div>
        </article>
      ) : (
        <p className={s.bar}>日付を正しく入れてください。</p>
      )}
    </>
  );
}
