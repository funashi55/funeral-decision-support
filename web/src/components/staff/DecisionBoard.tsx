"use client";
import { useState } from "react";
import { DECISIONS, PHASE_LABEL, type DecisionItem } from "../../domain/decisions";
import { EVIDENCE_SOURCE, evidenceFor, tipsFor } from "../../domain/decisionEvidence";
import type { CaseState } from "../../engine/case";
import type { OversightAlert } from "../../engine/oversight";
import { FeedbackButtons, type FeedbackHandler } from "./FeedbackButtons";
import s from "./staff.module.css";

interface DecisionBoardProps {
  readonly state: CaseState;
  /** 直前に変わった決定の影響を受け、見直しが必要な項目 */
  readonly impacted: ReadonlySet<string>;
  readonly onConfirm: (decisionId: string, value: string) => void;
  readonly oversights: readonly OversightAlert[];
  readonly onFeedback: FeedbackHandler;
}

/** 候補を確定する。言い間違いや聞き取りの誤りは、直してから確定できる */
function ConfirmControl({ item, value, onConfirm }: { item: DecisionItem; value: string; onConfirm: DecisionBoardProps["onConfirm"] }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (editing) {
    return (
      <form
        className={s.editForm}
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) onConfirm(item.id, draft.trim());
          setEditing(false);
        }}
      >
        <input aria-label={`${item.label}の内容`} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={200} autoFocus />
        <button type="submit" className={s.confirm}>
          確定
        </button>
      </form>
    );
  }
  return (
    <span className={s.confirmRow}>
      <button type="button" className={s.linkBtn} onClick={() => setEditing(true)}>
        直す
      </button>
      <button type="button" className={s.confirm} onClick={() => onConfirm(item.id, value)}>
        確定する
      </button>
    </span>
  );
}

/** 項目に添える実績（施行の記録の集計）と知見。数字は集計表から出す。長いので、開いたときだけ見せる */
function Grounding({ decisionId }: { readonly decisionId: string }) {
  const evidence = evidenceFor(decisionId);
  const tip = tipsFor(decisionId)[0];
  if (!evidence && !tip) return null;
  return (
    <details className={s.grounding}>
      <summary>{evidence ? "実績と知見" : "ベテランの知見"}</summary>
      {evidence && (
        <p title={`${EVIDENCE_SOURCE}・${evidence.count}件`}>
          <b>実績（参考）</b>
          {evidence.text}
        </p>
      )}
      {tip && (
        <p title={`根拠：${tip.source}`}>
          <b>知見</b>
          {tip.when}は、{tip.do}
        </p>
      )}
    </details>
  );
}

function Item({ item, state, impacted, onConfirm }: { item: DecisionItem } & Pick<DecisionBoardProps, "state" | "impacted" | "onConfirm">) {
  const d = state.decisions[item.id];
  const className = [s.item, impacted.has(item.id) ? s.itemImpacted : ""].join(" ");
  return (
    <div className={className}>
      <span>
        <span className={s.itemLabel}>
          {item.label}
          {item.hard && <span className={s.hardTag}>迷いやすい</span>}
        </span>
        <span className={s.itemVal}>{d ? `${d.status === "candidate" ? "候補：" : ""}${d.value}` : impacted.has(item.id) ? "見直しが必要です" : "未定"}</span>
        {d?.status !== "confirmed" && <Grounding decisionId={item.id} />}
      </span>
      {d?.status === "confirmed" ? (
        <span className={`${s.state} ${s.stateDone}`}>確定</span>
      ) : d ? (
        <ConfirmControl item={item} value={d.value} onConfirm={onConfirm} />
      ) : (
        <span className={`${s.state} ${s.stateOpen}`}>{item.urgency === "today" ? "今日" : "あとで"}</span>
      )}
    </div>
  );
}

export function DecisionBoard(props: DecisionBoardProps) {
  const { state } = props;
  const touched = DECISIONS.filter((d) => state.decisions[d.id] || props.impacted.has(d.id));
  const todayOpen = DECISIONS.filter((d) => d.urgency === "today" && state.decisions[d.id]?.status !== "confirmed");
  const confirmed = DECISIONS.filter((d) => state.decisions[d.id]?.status === "confirmed");
  const hardOpen = DECISIONS.filter((d) => d.hard && d.urgency === "today" && !state.decisions[d.id]);
  return (
    <section className={s.col} aria-labelledby="board-title">
      <div className={s.colHead}>
        <h2 id="board-title">決めることボード</h2>
        <span className={s.count}>全 {DECISIONS.length} 項目</span>
      </div>
      <div className={s.progress} aria-label={`今日決める ${todayOpen.length} 項目・確定 ${confirmed.length} 項目`}>
        <div className={s.progressNums}>
          <span>
            今日決める<b className={s.progressToday}>{todayOpen.length}</b>
          </span>
          <span>
            明日以降<b>{DECISIONS.length - todayOpen.length - confirmed.length}</b>
          </span>
          <span>
            確定<b className={s.progressDone}>{confirmed.length}</b>
          </span>
        </div>
        <span className={s.progressBar}>
          <i style={{ width: `${(confirmed.length / DECISIONS.length) * 100}%` }} />
        </span>
      </div>
      <div className={s.scroll}>
        {props.oversights.length > 0 && (
          <div className={s.group} data-testid="oversights">
            <h3>
              見落とし注意<span>{props.oversights.length}</span>
            </h3>
            {props.oversights.map((a) => (
              <div key={a.id} className={`${s.advice} ${s.caution}`}>
                <h3>{a.decisionLabel}</h3>
                <p>{a.message}</p>
                <div className={s.meta2}>
                  {a.utteranceIds.length > 0 && (
                    <span className={s.tag}>
                      きっかけ：「{state.utterances.find((u) => u.id === a.utteranceIds.at(-1))?.text.slice(0, 18)}…」
                    </span>
                  )}
                  <FeedbackButtons state={state} target={`oversight:${a.id}`} onFeedback={props.onFeedback} />
                </div>
              </div>
            ))}
          </div>
        )}
        {touched.length > 0 && (
          <div className={s.group}>
            <h3>
              会話で出てきた項目<span>{touched.length}</span>
            </h3>
            {touched.map((item) => (
              <Item key={item.id} item={item} state={state} impacted={props.impacted} onConfirm={props.onConfirm} />
            ))}
          </div>
        )}
        <div className={s.group}>
          <h3>
            今日決める・迷いやすい項目<span>{hardOpen.filter((d) => !touched.includes(d)).length}</span>
          </h3>
          {hardOpen
            .filter((d) => !touched.includes(d))
            .map((item) => (
              <div key={item.id} className={`${s.item} ${s.itemQuiet}`}>
                <span>
                  <span className={s.itemLabel}>{item.label}</span>
                  <span className={s.itemVal}>{PHASE_LABEL[item.phase]}</span>
                  <Grounding decisionId={item.id} />
                </span>
                <span className={`${s.state} ${s.stateOpen}`}>未定</span>
              </div>
            ))}
        </div>
      </div>
    </section>
  );
}
