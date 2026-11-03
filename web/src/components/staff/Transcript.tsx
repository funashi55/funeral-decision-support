import type { CaseState } from "../../engine/case";
import s from "./staff.module.css";

interface TranscriptProps {
  readonly state: CaseState;
  readonly extracting: boolean;
}

const mmss = (sec: number): string => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

export function Transcript({ state, extracting }: TranscriptProps) {
  return (
    <section className={s.col} aria-labelledby="transcript-title">
      <div className={s.colHead}>
        <h2 id="transcript-title">会話</h2>
        <span className={s.count}>{state.utterances.length} 発話</span>
      </div>
      <div className={s.scroll} aria-live="polite">
        {state.utterances.length === 0 && <p className={s.empty}>打合せを始めると、会話が文字になって流れます。</p>}
        {state.utterances.map((u) => (
          <p key={u.id} className={`${s.utt} ${u.speaker === "staff" ? s.uttStaff : ""}`}>
            <span className={s.uttWho}>
              <span>{u.speakerLabel}</span>
              <span>{mmss(u.at)}</span>
            </span>
            {u.text}
          </p>
        ))}
      </div>
      <div className={s.facts}>
        <h3>拾い上げた家族の事情 {extracting && <span className={s.thinking}>（整理中…）</span>}</h3>
        <div className={s.chips}>
          {state.circumstances.map((c) => (
            <span key={c.id} className={s.chip}>
              {c.text}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
