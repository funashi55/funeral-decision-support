import type { CaseState } from "../../engine/case";
import { buildChecklist, buildOrders } from "../../engine/orders";
import { OrderList } from "./OrderList";
import { PaperworkSection } from "./PaperworkSection";
import s from "./staff.module.css";
import { caseHref } from "../../domain/caseMode";


/** 確認表と発注リスト、基幹システム向けの書き出し。確定したものだけが手配に回る */
export function OrdersPanel({ state }: { readonly state: CaseState }) {
  const checklist = buildChecklist(state);
  const orders = buildOrders(state);
  const dueToday = checklist.filter((r) => r.dueToday);
  const ready = orders.filter((o) => o.status === "ready").length;
  return (
    <div className={s.scroll}>
      <div className={s.progressNums} style={{ marginBottom: "var(--space-3)" }}>
        <span>
          今日決める（未確定）<b className={s.progressToday}>{dueToday.length}</b>
        </span>
        <span>
          手配できる<b className={s.progressDone}>{ready}</b>
        </span>
        <span>
          発注・手配<b>{orders.length}</b>
        </span>
      </div>
      <PaperworkSection state={state} />
      <div className={s.linkRow}>
        <a className={s.btn} href={caseHref(state.caseId, "juchu")} target="_blank" rel="noopener">
          受注書
        </a>
        <a className={s.btn} href={caseHref(state.caseId, "nenkai")} target="_blank" rel="noopener">
          年回表（中陰月日表）
        </a>
        <a className={s.btn} href={`/api/cases/${encodeURIComponent(state.caseId)}/export`} download>
          基幹システムに取り込むファイル
        </a>
      </div>
      <p className={s.empty}>書き出すのは確定した項目だけです。会話から拾っただけの候補は含めません。</p>

      <OrderList state={state} />

      <details className={s.group}>
        <summary>確認表（全 {checklist.length} 項目）</summary>
        <table className={s.lines}>
          <tbody>
            {checklist.map((r) => (
              <tr key={r.decisionId}>
                <th scope="row">
                  {r.label}
                  {r.dueToday && <span className={`${s.tag} ${s.tagWarn}`}>今日</span>}
                </th>
                <td>{r.phaseLabel}</td>
                <td>{r.status === "confirmed" ? r.value : r.status === "candidate" ? `候補：${r.value}` : "未定"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
