import type { FamilyDecided } from "../../engine/familyView";
import s from "./family.module.css";

interface DecidedListProps {
  readonly decided: readonly FamilyDecided[];
  readonly onAskChange: (decisionId: string) => void;
}

export function DecidedList({ decided, onAskChange }: DecidedListProps) {
  return (
    <section className={s.section} aria-labelledby="decided-title">
      <div className={s.sectionHead}>
        <h2 id="decided-title">決まったこと</h2>
        <span className={s.count}>{decided.length} 件</span>
      </div>
      {decided.length === 0 ? (
        <p className={s.emptyCard}>まだ確定したことはありません。担当者と決めたことが、ここに残ります。</p>
      ) : (
        <ul className={s.decided}>
          {decided.map((d) => (
            <li key={d.id} className={s.decidedItem} data-testid={`decided-${d.id}`}>
              <span className={s.phase}>{d.phase}</span>
              <span className={s.decidedLabel}>{d.label}</span>
              <strong className={s.decidedValue}>{d.value}</strong>
              <span className={s.decidedFoot}>
                <span className={d.changeable ? s.changeOk : s.changeAsk}>{d.changeable ? "あとから変えられます" : "変える場合は早めにご相談ください"}</span>
                <button type="button" className={s.linkBtn} onClick={() => onAskChange(d.id)}>
                  変更をお願いする
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
