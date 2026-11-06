"use client";
import { useEffect, useState } from "react";
import { api } from "../../client/api";
import type { CaseState } from "../../engine/case";
import { SHEETABLE_ORDERS } from "../../engine/orderSheet";
import { buildOrders, type OrderStatus } from "../../engine/orders";
import type { OrderSheetMap } from "../../server/orderSheetStore";
import s from "./staff.module.css";

const STATUS_LABEL: Record<OrderStatus, string> = { ready: "手配できる", waiting: "確定待ち", not_needed: "不要" };
const STATUS_CLASS: Record<OrderStatus, string> = { ready: s.stateDone ?? "", waiting: s.stateCand ?? "", not_needed: s.stateOpen ?? "" };
const message = (e: unknown): string => (e instanceof Error ? e.message : "発注書を作れませんでした");

/**
 * 発注リスト。業者に頼む手配は1件ずつ「発注書を作る」で発注書にでき、作ったものはその場で開ける。
 * 確定待ちのものも下書きとして作れる（発注書に「下書き：確定待ち」と出る）
 */
export function OrderList({ state }: { readonly state: CaseState }) {
  const orders = buildOrders(state);
  const sheetsUrl = `/staff/${encodeURIComponent(state.caseId)}/paperwork`;
  const [made, setMade] = useState<OrderSheetMap>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .orderSheets(state.caseId)
      .then((m) => alive && setMade(m))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [state.caseId]);

  const make = async (orderId: string): Promise<void> => {
    setBusy(orderId);
    setError(null);
    try {
      setMade(await api.makeOrderSheet(state.caseId, orderId));
      window.open(`${sheetsUrl}?order=${orderId}`, "_blank", "noopener");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={s.group}>
      <h3>
        発注リスト<span>{orders.length}</span>
      </h3>
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      <ul className={s.orderList} data-testid="orders">
        {orders.map((o) => {
          const sheet = made[o.id];
          const canSheet = SHEETABLE_ORDERS.has(o.id) && o.status !== "not_needed";
          return (
            <li key={o.id} className={s.item}>
              <span>
                {o.label}
                <span className={s.itemVal}>
                  {o.status === "waiting" ? `待ち：${o.waitingFor.join("・")}` : o.details.map((d) => d.value).join("／")}
                  {!SHEETABLE_ORDERS.has(o.id) && "（電話・予約で手配）"}
                </span>
              </span>
              <span className={s.orderActions}>
                <span className={`${s.state} ${STATUS_CLASS[o.status]}`}>{STATUS_LABEL[o.status]}</span>
                {sheet && (
                  <a className={s.btn} href={`${sheetsUrl}?order=${o.id}`} target="_blank" rel="noopener">
                    発注書を見る
                  </a>
                )}
                {canSheet && (
                  <button type="button" className={`${s.btn} ${sheet ? "" : s.btnPrimary}`} onClick={() => void make(o.id)} disabled={busy !== null}>
                    {busy === o.id ? "作っています…" : sheet ? "作り直す" : o.status === "waiting" ? "下書きを作る" : "発注書を作る"}
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
