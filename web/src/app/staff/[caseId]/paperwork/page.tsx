import type { Metadata } from "next";
import { PrintButton } from "../../../../components/paperwork/PrintButton";
import s from "../../../../components/paperwork/sheet.module.css";
import type { OrderSheet, Paperwork } from "../../../../engine/paperwork";
import { paperworkStore } from "../../../../server/paperworkStore";

export const metadata: Metadata = { title: "発注書｜葬儀の打合せ支援（仮称）", robots: { index: false, follow: false } };

/** 発注元（デモ用の架空の葬儀社） */
const SENDER = "葬儀社（デモ・架空）";

const jstDate = (ms: number): string => new Date(ms).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric" });

function Sheet({ sheet, paperwork }: { readonly sheet: OrderSheet; readonly paperwork: Paperwork }) {
  return (
    <article className={s.sheet} aria-label={`${sheet.vendor}への発注書`}>
      <div className={s.head}>
        <h1 className={s.title}>発注書</h1>
        {sheet.status !== "ready" ? (
          <span className={s.draft}>下書き：確定待ち（{sheet.waitingFor.join("・")}）</span>
        ) : sheet.blanks > 0 ? (
          <span className={s.draft}>要確認の欄が {sheet.blanks} か所あります</span>
        ) : null}
      </div>
      <div className={s.to}>{sheet.vendor}　御中</div>
      <table className={s.meta}>
        <tbody>
          <tr>
            <th scope="row">発注日</th>
            <td>{jstDate(paperwork.createdAt)}</td>
            <th scope="row">発注元</th>
            <td>{SENDER}</td>
          </tr>
          <tr>
            <th scope="row">施行</th>
            <td>{paperwork.familyName}</td>
            <th scope="row">内容</th>
            <td>{sheet.label}</td>
          </tr>
          <tr>
            <th scope="row">納品・実施日時</th>
            <td>{sheet.deliverAt}</td>
            <th scope="row">納品・実施場所</th>
            <td>{sheet.deliverTo}</td>
          </tr>
        </tbody>
      </table>
      <table className={s.items}>
        <thead>
          <tr>
            <th scope="col">品名・内容</th>
            <th scope="col">数量</th>
            <th scope="col">備考</th>
          </tr>
        </thead>
        <tbody>
          {sheet.items.map((item, i) => (
            <tr key={`${item.name}-${i}`}>
              <td>{item.name}</td>
              <td>{item.quantity}</td>
              <td>{item.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {sheet.notes && (
        <div>
          <b>申し送り</b>
          <p className={s.note}>{sheet.notes}</p>
        </div>
      )}
      <div className={s.foot}>
        <p>「要確認」の欄は、ご家族に確かめたうえで担当者が書き込んでから送ってください。金額は見積書でご確認ください。</p>
        <div className={s.stamp}>
          <span>担当者</span>
          <span>確認者</span>
        </div>
      </div>
    </article>
  );
}

export default async function PaperworkPage({ params, searchParams }: PageProps<"/staff/[caseId]/paperwork">) {
  const { caseId } = await params;
  const { order } = await searchParams;
  const paperwork = await paperworkStore.get(caseId);
  if (!paperwork) {
    return (
      <main className={s.page}>
        <p className={s.bar}>まだ発注書がありません。担当者の画面の「手配と書き出し」で「まとめて発注書を作る」を押してください。</p>
      </main>
    );
  }
  const sheets = typeof order === "string" ? paperwork.sheets.filter((x) => x.orderId === order) : paperwork.sheets;
  return (
    <main className={s.page}>
      <div className={s.bar}>
        <span>
          {paperwork.familyName}・発注書 {sheets.length} 枚（A4）。「PDF に保存」を選ぶとファイルになり、FAX の送信に使えます。
        </span>
        <PrintButton />
      </div>
      {sheets.map((sheet) => (
        <Sheet key={sheet.orderId} sheet={sheet} paperwork={paperwork} />
      ))}
    </main>
  );
}
