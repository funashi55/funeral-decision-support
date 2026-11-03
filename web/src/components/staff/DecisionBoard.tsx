import { DECISIONS, PHASE_LABEL, type DecisionItem } from "../../domain/decisions";
import type { CaseState } from "../../engine/case";
import s from "./staff.module.css";

interface DecisionBoardProps {
  readonly state: CaseState;
  /** 直前に変わった決定の影響を受け、見直しが必要な項目 */
  readonly impacted: ReadonlySet<string>;
  readonly onConfirm: (decisionId: string, value: string) => void;
}

function Item({ item, state, impacted, onConfirm }: { item: DecisionItem } & DecisionBoardProps) {
  const d = state.decisions[item.id];
  const className = [s.item, impacted.has(item.id) ? s.itemImpacted : ""].join(" ");
  return (
    <div className={className}>
      <span>
        <span className={item.hard ? s.itemHard : undefined}>{item.label}</span>
        <span className={s.itemVal}>{d ? `${d.status === "candidate" ? "候補：" : ""}${d.value}` : impacted.has(item.id) ? "見直しが必要です" : "未定"}</span>
      </span>
      {d?.status === "confirmed" ? (
        <span className={`${s.state} ${s.stateDone}`}>確定</span>
      ) : d ? (
        <button type="button" className={s.confirm} onClick={() => onConfirm(item.id, d.value)}>
          確定する
        </button>
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
      <div className={s.summary}>
        <div className={`${s.sum} ${s.sumToday}`}>
          <b>{todayOpen.length}</b>
          <span>今日決める</span>
        </div>
        <div className={s.sum}>
          <b>{DECISIONS.length - todayOpen.length - confirmed.length}</b>
          <span>明日以降でよい</span>
        </div>
        <div className={s.sum}>
          <b>{confirmed.length}</b>
          <span>確定済み</span>
        </div>
      </div>
      <div className={s.scroll}>
        {touched.length > 0 && (
          <div className={s.group}>
            <h3>
              会話で出てきた項目<span>{touched.length}</span>
            </h3>
            {touched.map((item) => (
              <Item key={item.id} item={item} {...props} />
            ))}
          </div>
        )}
        <div className={s.group}>
          <h3>
            今日決める・迷いやすい項目<span>{hardOpen.length}</span>
          </h3>
          {hardOpen
            .filter((d) => !touched.includes(d))
            .map((item) => (
              <div key={item.id} className={s.item}>
                <span>
                  <span className={s.itemHard}>{item.label}</span>
                  <span className={s.itemVal}>{PHASE_LABEL[item.phase]}</span>
                </span>
                <span className={`${s.state} ${s.stateOpen}`}>未定</span>
              </div>
            ))}
        </div>
      </div>
    </section>
  );
}
