"use client";
import { useEffect, useState } from "react";
import { api } from "../../client/api";
import type { CaseState } from "../../engine/case";
import { TODO_STAGES, isSendable, type OrderSheet, type Paperwork } from "../../engine/paperwork";
import s from "./staff.module.css";

const message = (e: unknown): string => (e instanceof Error ? e.message : "問題が起きました");
function sheetStatus(sheet: OrderSheet): string {
  if (sheet.status !== "ready") return "下書き（確定待ち）";
  return isSendable(sheet) ? "送れる" : `要確認 ${sheet.blanks} か所を埋めて送る`;
}

/** 打合せの後の実務：Claude がまとめ・TODO・発注書の下書きを作る。発注書は印刷・PDF・FAX 用のページで開く */
export function PaperworkSection({ state }: { readonly state: CaseState }) {
  const [paperwork, setPaperwork] = useState<Paperwork | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ReadonlySet<number>>(new Set());

  useEffect(() => {
    let alive = true;
    api
      .paperwork(state.caseId)
      .then((p) => alive && setPaperwork(p))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [state.caseId]);

  const make = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      setPaperwork(await api.makePaperwork(state.caseId));
      setDone(new Set());
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (i: number): void =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const stale = paperwork && paperwork.basedOn < state.utterances.length;
  const sheetsUrl = `/staff/${encodeURIComponent(state.caseId)}/paperwork`;

  return (
    <section className={s.group} aria-labelledby="paperwork-title" data-testid="paperwork">
      <h3 id="paperwork-title">打合せのまとめと発注書の下書き</h3>
      <div className={s.toolbar} style={{ padding: 0 }}>
        <span className={s.count}>
          {paperwork ? `${paperwork.basedOn}発言目までで作成${stale ? "（その後の発言は入っていません）" : ""}` : "会話と決めたことから、やることと発注書の下書きを作ります（30秒ほど）"}
        </span>
        <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={() => void make()} disabled={busy || state.utterances.length === 0}>
          {busy ? "まとめています…" : paperwork ? "作り直す" : "まとめて発注書を作る"}
        </button>
      </div>
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      {paperwork && (
        <>
          <p className={s.reason}>{paperwork.summary}</p>

          <h3>
            担当者のやること<span>{paperwork.todos.length - done.size}</span>
          </h3>
          {TODO_STAGES.map((stage) => {
            const items = paperwork.todos.map((t, i) => ({ t, i })).filter(({ t }) => t.stage === stage);
            if (items.length === 0) return null;
            return (
              <div key={stage}>
                <p className={s.todoStage}>{stage}</p>
                <ul className={s.todoList}>
                  {items.map(({ t, i }) => (
                    <li key={`${t.task}-${i}`}>
                      <label>
                        <input type="checkbox" checked={done.has(i)} onChange={() => toggle(i)} />
                        <span className={done.has(i) ? s.todoDone : undefined}>
                          {t.task}
                          <span className={s.itemVal}>
                            {t.when}
                            {t.source === "board" ? "・決めることボードから" : t.source === "template" ? "・毎回の定番" : ""}
                          </span>
                        </span>
                      </label>
                      {t.task.includes("年回表") && (
                        <a className={s.btn} href={`/staff/${encodeURIComponent(state.caseId)}/nenkai`} target="_blank" rel="noopener">
                          年回表を作る
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          {paperwork.askFamily.length > 0 && (
            <>
              <h3>発注の前にご家族に確かめること</h3>
              <ul className={s.todoList}>
                {paperwork.askFamily.map((q) => (
                  <li key={q}>・{q}</li>
                ))}
              </ul>
            </>
          )}

          <h3>
            発注書<span>{paperwork.sheets.length}</span>
          </h3>
          <a className={`${s.btn} ${s.btnPrimary}`} href={`/staff/${encodeURIComponent(state.caseId)}/juchu`} target="_blank" rel="noopener">
            受注書を開く（{paperwork.ledger.length} 品目・チェック表）
          </a>{" "}
          <a className={`${s.btn} ${s.btnPrimary}`} href={sheetsUrl} target="_blank" rel="noopener">
            すべての発注書を開く（印刷・PDF・FAX）
          </a>
          <ul className={s.orderList}>
            {paperwork.sheets.map((sheet) => (
              <li key={sheet.orderId} className={s.item}>
                <span>
                  {sheet.vendor}：{sheet.label}
                  <span className={s.itemVal}>
                    {sheet.items.map((i) => `${i.name} ${i.quantity}`).join("／")}
                    {sheet.status === "waiting" ? `｜確定待ち：${sheet.waitingFor.join("・")}` : ""}
                  </span>
                </span>
                <a className={s.btn} href={`${sheetsUrl}?order=${sheet.orderId}`} target="_blank" rel="noopener">
                  {sheetStatus(sheet)}・開く
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
