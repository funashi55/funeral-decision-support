import type { Metadata } from "next";
import { PrintButton } from "../../../../components/paperwork/PrintButton";
import s from "../../../../components/paperwork/sheet.module.css";
import type { Paperwork } from "../../../../engine/paperwork";
import { paperworkStore } from "../../../../server/paperworkStore";

export const metadata: Metadata = { title: "受注書｜葬儀の打合せ支援（仮称）", robots: { index: false, follow: false } };

const SCHEDULE: readonly { readonly key: keyof Paperwork["schedule"]; readonly label: string }[] = [
  { key: "death", label: "死亡" },
  { key: "layingIn", label: "納棺" },
  { key: "departure", label: "出棺" },
  { key: "cremation", label: "火葬" },
  { key: "wake", label: "通夜" },
  { key: "funeral", label: "葬式" },
  { key: "burial", label: "埋葬" },
  { key: "meal", label: "会食" },
];

const jstDate = (ms: number): string => new Date(ms).toLocaleDateString("ja-JP-u-ca-japanese", { timeZone: "Asia/Tokyo", era: "long", year: "numeric", month: "long", day: "numeric" });

/**
 * 受注書：施行ごとの親の表。東北地方の互助会系葬儀社の受注書の並び（日程・品目・数量・追加・返品・発注先・チェック）に合わせた。
 * 氏名・住所・電話は保存しないので、手書きの欄にする。追加・返品・計・チェックは当日に手で書き込む
 */
export default async function JuchuPage({ params }: PageProps<"/staff/[caseId]/juchu">) {
  const { caseId } = await params;
  const pw = await paperworkStore.get(caseId);
  if (!pw) {
    return (
      <main className={s.page} data-print-page>
        <p className={s.bar}>まだ受注書がありません。担当者の画面の「手配と書き出し」で「まとめて発注書を作る」を押してください。</p>
      </main>
    );
  }
  return (
    <main className={s.page} data-print-page>
      <div className={s.bar}>
        <span>{pw.familyName}・受注書（A4）。氏名・住所・電話と、追加・返品・チェックの欄は手で書き込んでください。</span>
        <PrintButton />
      </div>
      <article className={s.sheet} aria-label="受注書">
        <div className={s.head}>
          <h1 className={s.title}>受注書</h1>
          <p className={s.note}>
            {jstDate(pw.createdAt)}　担当者＿＿＿＿＿＿
          </p>
        </div>
        <div className={s.to}>{pw.familyName}</div>
        <table className={s.meta}>
          <tbody>
            <tr>
              <th scope="row">故人様</th>
              <td aria-label="手書きで記入する欄" />
              <th scope="row">年齢・性別</th>
              <td>
                {pw.deceased.age}・{pw.deceased.sex}
              </td>
            </tr>
            <tr>
              <th scope="row">喪主</th>
              <td aria-label="手書きで記入する欄" />
              <th scope="row">続柄・TEL</th>
              <td aria-label="手書きで記入する欄" />
            </tr>
            <tr>
              <th scope="row">式場</th>
              <td>{pw.venue}</td>
              <th scope="row">安置先</th>
              <td>{pw.restingPlace}</td>
            </tr>
          </tbody>
        </table>
        <table className={s.meta}>
          <tbody>
            {[0, 2, 4, 6].map((i) => (
              <tr key={i}>
                {SCHEDULE.slice(i, i + 2).map((row) => (
                  <ScheduleCells key={row.key} label={row.label} value={pw.schedule[row.key]} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <table className={s.items}>
          <thead>
            <tr>
              <th scope="col">区分</th>
              <th scope="col">品目</th>
              <th scope="col">数量</th>
              <th scope="col">追加</th>
              <th scope="col">返品</th>
              <th scope="col">計</th>
              <th scope="col">発注先</th>
              <th scope="col">備考</th>
              <th scope="col">チェック</th>
            </tr>
          </thead>
          <tbody>
            {pw.ledger.map((r, i) => (
              <tr key={`${r.name}-${i}`} className={s.row}>
                <td>{r.category}</td>
                <td>{r.name}</td>
                <td>{r.quantity}</td>
                <td />
                <td />
                <td />
                <td>
                  {r.vendor}
                  {r.status === "waiting" ? "（確定待ち）" : ""}
                </td>
                <td>{r.note}</td>
                <td className={s.check}>□</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className={s.foot}>
          <p>「要確認」はご家族に確かめてから書き込んでください。金額は見積書でご確認ください。</p>
        </div>
      </article>
    </main>
  );
}

function ScheduleCells({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <>
      <th scope="row">{label}</th>
      <td>{value}</td>
    </>
  );
}
