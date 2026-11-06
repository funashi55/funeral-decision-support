import type { Metadata } from "next";
import { PrintButton } from "../../../../components/paperwork/PrintButton";
import s from "../../../../components/paperwork/sheet.module.css";
import type { SheetContext } from "../../../../engine/orderSheet";
import type { OrderSheet } from "../../../../engine/paperwork";
import { orderSheetStore } from "../../../../server/orderSheetStore";
import { paperworkStore } from "../../../../server/paperworkStore";

export const metadata: Metadata = { title: "発注書｜葬儀の打合せ支援（仮称）", robots: { index: false, follow: false } };

/** 発注元（デモ用の架空の葬儀社） */
const SENDER = "葬儀社（デモ・架空）";

/** 故人の年齢・性別を書く業者（花は故人に合わせて色や形を選ぶため） */
const NEEDS_DECEASED = new Set(["flowers", "farewell_flowers", "pillow_set"]);

const jstDate = (ms: number): string => new Date(ms).toLocaleDateString("ja-JP-u-ca-japanese", { timeZone: "Asia/Tokyo", era: "long", year: "numeric", month: "long", day: "numeric" });

/**
 * FAX で送る発注書。東北地方の互助会系葬儀社が実際に使っていた発注書の並びに合わせた：
 * 宛先・発注元と担当・葬家名 → 式場（届け先）・届け日時 → 葬儀日程 → 注文内容 → 業者ごとの確認欄 → 確認の返信のお願い
 */
function Sheet({ sheet, paperwork }: { readonly sheet: OrderSheet; readonly paperwork: SheetContext }) {
  const sc = paperwork.schedule;
  return (
    <article className={s.sheet} aria-label={`${sheet.vendor}への発注書`}>
      <div className={s.head}>
        <div className={s.to}>{sheet.vendor}　御中</div>
        {sheet.status !== "ready" ? (
          <span className={s.draft}>下書き：確定待ち（{sheet.waitingFor.join("・")}）</span>
        ) : sheet.blanks > 0 ? (
          <span className={s.draft}>要確認の欄が {sheet.blanks} か所あります</span>
        ) : null}
      </div>
      <div className={s.head}>
        <h1 className={s.title}>発注書</h1>
        <p className={s.note}>
          {jstDate(paperwork.createdAt)}
          <br />
          {SENDER}　担当：＿＿＿＿＿＿
          <br />
          TEL：＿＿＿＿＿＿＿＿＿
        </p>
      </div>
      <div className={s.to}>{paperwork.familyName}</div>
      <table className={s.meta}>
        <tbody>
          <tr>
            <th scope="row">内容</th>
            <td colSpan={3}>{sheet.label}</td>
          </tr>
          <tr>
            <th scope="row">式場（届け先）</th>
            <td>{sheet.deliverTo || paperwork.venue}</td>
            <th scope="row">届け日時</th>
            <td>{sheet.deliverAt}</td>
          </tr>
          <tr>
            <th scope="row">葬儀日程</th>
            <td colSpan={3}>
              出棺：{sc.departure}　通夜：{sc.wake}
              <br />
              葬式：{sc.funeral}　火葬：{sc.cremation}
            </td>
          </tr>
          {NEEDS_DECEASED.has(sheet.orderId) && (
            <tr>
              <th scope="row">故人様</th>
              <td colSpan={3}>
                年齢：{paperwork.deceased.age}　性別：{paperwork.deceased.sex}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <table className={s.items}>
        <thead>
          <tr>
            <th scope="col">注文内容</th>
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
      {sheet.extras.length > 0 && (
        <table className={s.meta}>
          <tbody>
            {sheet.extras.map((e) => (
              <tr key={e.label}>
                <th scope="row">{e.label}</th>
                <td>{e.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {sheet.notes && (
        <div>
          <b>申し送り</b>
          <p className={s.note}>{sheet.notes}</p>
        </div>
      )}
      <div className={s.foot}>
        <p>
          <b>FAX が届き次第、確認の FAX をご返信ください。</b>
          <br />
          返信先 FAX：＿＿＿＿＿＿＿＿＿（{SENDER}）
          <br />
          「要確認」の欄は、ご家族に確かめたうえで担当者が書き込んでから送ります。金額は見積書でご確認ください。
        </p>
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
  const [paperwork, singles] = await Promise.all([paperworkStore.get(caseId), orderSheetStore.all(caseId)]);
  // 1枚ずつ作った発注書は、まとめて作ったものより新しければそちらを出す
  const single = typeof order === "string" ? singles[order] : undefined;
  const fromBatch = typeof order === "string" ? paperwork?.sheets.filter((x) => x.orderId === order) : paperwork?.sheets;
  const useSingle = single && (!fromBatch?.length || !paperwork || single.context.createdAt >= paperwork.createdAt);
  const context: SheetContext | undefined = useSingle ? single.context : paperwork;
  const sheets = useSingle ? [single.sheet] : (fromBatch ?? []);
  if (!context || sheets.length === 0) {
    return (
      <main className={s.page} data-print-page>
        <p className={s.bar}>まだ発注書がありません。担当者の画面の「手配」で、発注リストの「発注書を作る」を押してください。</p>
      </main>
    );
  }
  return (
    <main className={s.page} data-print-page>
      <div className={s.bar}>
        <span>
          {context.familyName}・発注書 {sheets.length} 枚（A4）。「PDF に保存」を選ぶとファイルになり、FAX の送信に使えます。
        </span>
        <PrintButton />
      </div>
      {sheets.map((sheet) => (
        <Sheet key={sheet.orderId} sheet={sheet} paperwork={context} />
      ))}
    </main>
  );
}
