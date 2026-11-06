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
        <a className={s.btn} href={`/staff/${encodeURIComponent(state.caseId)}/nenkai`} target="_blank" rel="noopener">
          年回表（中陰月日表）
        </a>
        <a className={s.btn} href={`/api/cases/${encodeURIComponent(state.caseId)}/export`} download>
          基幹システム向け CSV
        </a>
      </div>
      <p className={s.empty}>CSV に書き出すのは確定した項目だけです。AI が拾っただけの候補は含めません。</p>

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
