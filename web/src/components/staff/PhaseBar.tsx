import { PHASE_LABEL, type Phase } from "../../domain/decisions";
import { PHASE_HINT, type PhaseReading } from "../../engine/phase";
import s from "./staff.module.css";

const STEPS: readonly Phase[] = ["trust", "hearing", "farewell", "schedule", "plan", "logistics"];

/** いま話している話題。決まった順はないので、番号や「済み」は付けず、話題を並べて今のものだけを示す */
export function PhaseBar({ reading }: { readonly reading: PhaseReading }) {
  const current = STEPS.indexOf(reading.phase);
  return (
    <nav className={s.phaseBar} aria-label="いまの話題">
      <ul>
        {STEPS.map((p, i) => (
          <li key={p} className={i === current ? s.phaseNow : undefined} aria-current={i === current ? "step" : undefined}>
            {PHASE_LABEL[p]}
          </li>
        ))}
      </ul>
      <p data-testid="phase-hint">{PHASE_HINT[reading.phase]}</p>
    </nav>
  );
}
