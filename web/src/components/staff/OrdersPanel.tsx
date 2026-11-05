import type { CaseState } from "../../engine/case";
import { buildChecklist, buildOrders, type OrderStatus } from "../../engine/orders";
import { PaperworkSection } from "./PaperworkSection";
import s from "./staff.module.css";

const STATUS_LABEL: Record<OrderStatus, string> = { ready: "手配できる", waiting: "確定待ち", not_needed: "不要" };
const STATUS_CLASS: Record<OrderStatus, string> = { ready: s.stateDone ?? "", waiting: s.stateCand ?? "", not_needed: s.stateOpen ?? "" };

/** 確認表と発注リスト、基幹システム向けの書き出し。確定したものだけが手配に回る */
export function OrdersPanel({ state }: { readonly state: CaseState }) {
  const checklist = buildChecklist(state);
  const orders = buildOrders(state);
  const dueToday = checklist.filter((r) => r.dueToday);
  const ready = orders.filter((o) => o.status === "ready").length;
  return (
    <div className={s.scroll}>
      <div className={s.summary} style={{ padding: "0 0 0.6rem" }}>
        <div className={`${s.sum} ${s.sumToday}`}>
          <b>{dueToday.length}</b>
          <span>今日決める（未確定）</span>
        </div>
        <div className={s.sum}>
          <b>{ready}</b>
          <span>手配できる</span>
        </div>
        <div className={s.sum}>
          <b>{orders.length}</b>
          <span>発注・手配の項目</span>
        </div>
      </div>
      <PaperworkSection state={state} />
      <a className={s.btn} href={`/staff/${encodeURIComponent(state.caseId)}/nenkai`} target="_blank" rel="noopener">
        年回表（中陰月日表）を作る
      </a>
      <a className={`${s.btn} ${s.btnPrimary}`} href={`/api/cases/${encodeURIComponent(state.caseId)}/export`} download>
        基幹システム向けに書き出す（CSV）
      </a>
      <p className={s.empty}>書き出すのは確定した項目だけです。AI が拾っただけの候補は含めません。</p>

      <div className={s.group}>
        <h3>
          発注リスト<span>{orders.length}</span>
        </h3>
        <ul className={s.orderList} data-testid="orders">
          {orders.map((o) => (
            <li key={o.id} className={s.item}>
              <span>
                {o.label}
                <span className={s.itemVal}>
                  {o.status === "waiting" ? `待ち：${o.waitingFor.join("・")}` : o.details.map((d) => d.value).join("／")}
                </span>
              </span>
              <span className={`${s.state} ${STATUS_CLASS[o.status]}`}>{STATUS_LABEL[o.status]}</span>
            </li>
          ))}
        </ul>
      </div>

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
