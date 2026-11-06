"use client";
import { useEffect, useRef, useState } from "react";
import type { HearingScene } from "../../../data/hearingScenes";
import type { Extraction, FamilyReply, HearingTurn } from "../../../engine/hearing";
import { Composer, speak } from "./Composer";
import { WrapUp } from "./WrapUp";
import { postJson, type Experience, type InputMode, type SceneProgress } from "./hearingDraft";
import s from "../trial.module.css";
import h from "./hearing.module.css";

interface SceneFlowProps {
  readonly scene: HearingScene;
  readonly progress: SceneProgress;
  readonly mode: InputMode;
  readonly respondent: string;
  readonly experience: Experience | "";
  readonly onChange: (fn: (p: SceneProgress) => SceneProgress) => void;
  readonly onBack: () => void;
}

/** 打合せを終えられるまでの、担当者の発言の数 */
const MIN_VETERAN_TURNS = 2;

export function SceneFlow({ scene, progress, mode, respondent, experience, onChange, onBack }: SceneFlowProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { stage, turns } = progress;
  const veteranTurns = turns.filter((t) => t.role === "veteran").length;
  const endRef = useRef<HTMLLIElement>(null);
  // 新しい発言が入ったら、入力欄に隠れないよう下まで送る
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, busy]);

  const run = async (task: () => Promise<void>): Promise<void> => {
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "うまく届きませんでした。もう一度お試しください");
    } finally {
      setBusy(false);
    }
  };

  const askFamily = (next: readonly HearingTurn[]): Promise<void> =>
    run(async () => {
      const reply = await postJson<FamilyReply>("/api/veteran/hearing/turn", { sceneId: scene.id, turns: next });
      const lines: HearingTurn[] = reply.lines.map((l) => ({ role: "family", speaker: l.speaker, text: l.text }));
      onChange((p) => ({ ...p, turns: [...next, ...lines], revealed: [...p.revealed, ...reply.revealed.filter((id) => !p.revealed.includes(id))] }));
      if (mode === "voice") lines.forEach((l) => speak(l.text));
    });

  const say = (text: string): void => {
    const next: HearingTurn[] = [...turns, { role: "veteran", speaker: "担当者", text }];
    onChange((p) => ({ ...p, turns: next }));
    void askFamily(next);
  };

  const extract = (): Promise<void> =>
    run(async () => {
      const result = await postJson<Extraction>("/api/veteran/hearing/extract", { sceneId: scene.id, turns });
      onChange((p) => ({ ...p, stage: "confirm", judgments: result.judgments, firstWords: result.firstWords, verdicts: {}, notes: {} }));
    });

  const submit = (comment: string): Promise<void> =>
    run(async () => {
      await postJson("/api/veteran/hearing/submit", {
        respondent,
        experience,
        sceneId: scene.id,
        mode,
        turns,
        revealed: progress.revealed,
        fits: progress.fits,
        judgments: progress.judgments.map((j, i) => ({ ...j, verdict: progress.verdicts[i] ?? "unsure", note: progress.notes[i] ?? "" })),
        firstWords: progress.firstWords,
        comment,
      });
      onChange((p) => ({ ...p, stage: "sent" }));
    });

  return (
    <section aria-labelledby="scene-title">
      <button type="button" className={s.buttonGhost} onClick={onBack}>
        ← ご家族の一覧へ
      </button>
      <h2 id="scene-title" className={h.stageTitle} style={{ marginTop: "1rem" }}>
        {scene.title}
      </h2>

      {stage === "card" && (
        <div className={s.card}>
          <p className={h.stageLead}>受付で伺っていることです。</p>
          <ul className={h.facts}>
            {scene.card.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p className={h.room}>打合せ室で、{scene.family.map((m) => m.label).join("・")}がお待ちです。</p>
          <p className={h.stageLead}>
            お悔やみの言葉から、いつもどおりに打合せを始めてください。正解の筋はありません。区切りのよいところで「打合せを終える」を押します。
          </p>
          <button type="button" className={s.button} onClick={() => onChange((p) => ({ ...p, stage: "roleplay" }))}>
            打合せ室に入る
          </button>
        </div>
      )}

      {stage === "roleplay" && (
        <>
          <p className={h.present} aria-label="同席している方">
            {scene.family.map((m) => (
              <span key={m.label} className={h.person}>
                {m.label}
              </span>
            ))}
          </p>
          <ol className={h.log} aria-live="polite">
            {turns.length === 0 && <li className={h.direction}>ご家族が席に着かれました。</li>}
            {turns.map((t, i) => (
              <li key={i} className={`${h.bubble} ${t.role === "veteran" ? h.veteran : h.family}`}>
                <small>{t.role === "veteran" ? "あなた" : t.speaker}</small>
                {t.text}
              </li>
            ))}
            {busy && <li className={h.typing}>……</li>}
            <li ref={endRef} aria-hidden="true" style={{ scrollMarginBottom: "180px" }} />
          </ol>
          {error && (
            <p className={s.error} role="alert">
              {error}
              {turns.at(-1)?.role === "veteran" && (
                <button type="button" className={s.buttonGhost} style={{ marginLeft: "0.75rem" }} onClick={() => void askFamily(turns)}>
                  もう一度
                </button>
              )}
            </p>
          )}
          <Composer mode={mode} busy={busy} placeholder="ご家族への言葉" onSend={say}>
            <button type="button" className={s.buttonGhost} onClick={() => onChange((p) => ({ ...p, stage: "fits" }))} disabled={busy || veteranTurns < MIN_VETERAN_TURNS}>
              打合せを終える
            </button>
          </Composer>
        </>
      )}

      {(stage === "fits" || stage === "confirm" || stage === "sent") && (
        <WrapUp progress={progress} busy={busy} error={error} onChange={onChange} onExtract={() => void extract()} onSubmit={(c) => void submit(c)} onBack={onBack} />
      )}
    </section>
  );
}
