import type { CaseState, FeedbackVerdict } from "../../engine/case";
import s from "./staff.module.css";

export type FeedbackHandler = (target: string, verdict: FeedbackVerdict | "clear") => void;

interface FeedbackButtonsProps {
  readonly state: CaseState;
  /** 例：farewell:yukan */
  readonly target: string;
  readonly onFeedback: FeedbackHandler;
}

/** 「伝えた／使わない」の記録。知見の改善に使う（家族には見えない） */
export function FeedbackButtons({ state, target, onFeedback }: FeedbackButtonsProps) {
  const current = state.feedback.find((f) => f.target === target)?.verdict;
  return (
    <span className={s.feedback} role="group" aria-label="この提案を使ったか">
      <button type="button" className={current === "told" ? s.fbOn : undefined} aria-pressed={current === "told"} onClick={() => onFeedback(target, "told")}>
        伝えた
      </button>
      <button type="button" className={current === "unused" ? s.fbOn : undefined} aria-pressed={current === "unused"} onClick={() => onFeedback(target, "unused")}>
        使わない
      </button>
    </span>
  );
}
