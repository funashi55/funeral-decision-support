import { PHASE_LABEL, type Phase } from "../../domain/decisions";
import { PHASE_HINT, type PhaseReading } from "../../engine/phase";
import s from "./staff.module.css";

const STEPS: readonly Phase[] = ["trust", "hearing", "farewell", "schedule", "plan", "logistics"];

/** 打合せの今の段階と、その段階でベテランが気をつけること */
export function PhaseBar({ reading }: { readonly reading: PhaseReading }) {
  const current = STEPS.indexOf(reading.phase);
  return (
    <nav className={s.phaseBar} aria-label="打合せの段階">
      <ol>
        {STEPS.map((p, i) => (
          <li key={p} className={i === current ? s.phaseNow : i < current ? s.phaseDone : undefined} aria-current={i === current ? "step" : undefined}>
            {PHASE_LABEL[p]}
          </li>
        ))}
      </ol>
      <p data-testid="phase-hint">{PHASE_HINT[reading.phase]}</p>
    </nav>
  );
}
