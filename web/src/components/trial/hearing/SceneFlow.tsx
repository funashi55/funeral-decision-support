"use client";
import { useEffect, useRef, useState } from "react";
import type { HearingScene } from "../../../data/hearingScenes";
import type { Extraction, FamilyReply, HearingTurn, InterviewerReply } from "../../../engine/hearing";
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

/** ロールプレイを終えられるまでの、担当者の発言の数 */
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
      const reply = await postJson<FamilyReply>("/api/veteran/hearing/turn", { sceneId: scene.id, phase: "roleplay", turns: next });
      const lines: HearingTurn[] = reply.lines.map((l) => ({ role: "family", speaker: l.speaker, text: l.text }));
      onChange((p) => ({ ...p, turns: [...next, ...lines], revealed: [...p.revealed, ...reply.revealed.filter((id) => !p.revealed.includes(id))] }));
      if (mode === "voice") lines.forEach((l) => speak(l.text));
    });

  const askInterviewer = (next: readonly HearingTurn[]): Promise<void> =>
    run(async () => {
      const reply = await postJson<InterviewerReply>("/api/veteran/hearing/turn", { sceneId: scene.id, phase: "debrief", turns: next });
      const turn: HearingTurn = { role: "interviewer", speaker: "聞き手", text: reply.question };
      onChange((p) => ({ ...p, turns: [...next, turn], stage: reply.done ? "fits" : "debrief" }));
      if (mode === "voice") speak(reply.question);
    });

  const say = (text: string): void => {
    const next: HearingTurn[] = [...turns, { role: "veteran", speaker: "担当者", text }];
    onChange((p) => ({ ...p, turns: next }));
    void (stage === "roleplay" ? askFamily(next) : askInterviewer(next));
  };

  const startDebrief = (): void => {
    onChange((p) => ({ ...p, stage: "debrief" }));
    void askInterviewer(turns);
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

  const roleplayLog = turns.filter((t) => stage === "roleplay" || t.role !== "interviewer");
  const shownTurns = stage === "debrief" ? turns.filter((t) => t.role === "interviewer" || turns.indexOf(t) >= firstInterviewerIndex(turns)) : roleplayLog;

  return (
    <section aria-labelledby="scene-title">
      <button type="button" className={s.buttonGhost} onClick={onBack}>
        ← 場面の一覧へ
      </button>
      <h2 id="scene-title" className={h.stageTitle} style={{ marginTop: "1rem" }}>
        {scene.title}
      </h2>

      {stage === "card" && (
        <div className={s.card}>
          <p className={h.stageLead}>打合せの前にわかっていることです。読んだら、担当者として打合せを始めてください。ご家族は Claude が演じます。ご家族は、聞かれたことに答えます。</p>
          <ul className={h.facts}>
            {scene.card.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p className={h.stageLead} style={{ marginTop: "1rem" }}>
            正解の筋はありません。いつもの打合せのように、声をかけ、尋ね、決めることを進めてください。5分ほどで、区切りのよいところで終えて構いません。
          </p>
          <button type="button" className={s.button} onClick={() => onChange((p) => ({ ...p, stage: "roleplay" }))}>
            打合せを始める
          </button>
        </div>
      )}

      {(stage === "roleplay" || stage === "debrief") && (
        <>
          <p className={h.stageLead}>
            {stage === "roleplay"
              ? "担当者として話してください。終えるときは「打合せを終える」を押します。"
              : "ふりかえりです。聞き手の問いに、思ったまま答えてください。答えにくい問いは「わからない」で構いません。"}
          </p>
          <ol className={h.log} aria-live="polite">
            {stage === "roleplay" &&
              scene.opening.map((l, i) => (
                <li key={`o${i}`} className={`${h.bubble} ${h.family}`}>
                  <small>{l.speaker}</small>
                  {l.text}
                </li>
              ))}
            {shownTurns.map((t, i) => (
              <li key={i} className={`${h.bubble} ${t.role === "veteran" ? h.veteran : t.role === "interviewer" ? h.interviewer : h.family}`}>
                <small>{t.role === "veteran" ? "あなた" : t.speaker}</small>
                {t.text}
              </li>
            ))}
            {busy && <li className={h.typing}>{stage === "roleplay" ? "ご家族が考えています…" : "聞き手が考えています…"}</li>}
            <li ref={endRef} aria-hidden="true" style={{ scrollMarginBottom: "180px" }} />
          </ol>
          {error && (
            <p className={s.error} role="alert">
              {error}
              {turns.at(-1)?.role === "veteran" && (
                <button type="button" className={s.buttonGhost} style={{ marginLeft: "0.75rem" }} onClick={() => void (stage === "roleplay" ? askFamily(turns) : askInterviewer(turns))}>
                  もう一度
                </button>
              )}
            </p>
          )}
          <Composer mode={mode} busy={busy} placeholder={stage === "roleplay" ? "ご家族への言葉" : "聞き手への答え"} onSend={say}>
            {stage === "roleplay" && (
              <button type="button" className={s.buttonGhost} onClick={startDebrief} disabled={busy || veteranTurns < MIN_VETERAN_TURNS}>
                打合せを終える
              </button>
            )}
            {stage === "debrief" && (
              <button type="button" className={s.buttonGhost} onClick={() => onChange((p) => ({ ...p, stage: "fits" }))} disabled={busy}>
                ふりかえりを終える
              </button>
            )}
          </Composer>
        </>
      )}

      {(stage === "fits" || stage === "confirm" || stage === "sent") && (
        <WrapUp progress={progress} busy={busy} error={error} onChange={onChange} onExtract={() => void extract()} onSubmit={(c) => void submit(c)} onBack={onBack} />
      )}
    </section>
  );
}

function firstInterviewerIndex(turns: readonly HearingTurn[]): number {
  const i = turns.findIndex((t) => t.role === "interviewer");
  return i < 0 ? turns.length : i;
}
