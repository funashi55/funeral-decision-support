"use client";

import { useState, useSyncExternalStore } from "react";
import { FITS, FIT_LABEL, SCENES, type Fit } from "../../data/judgmentScenes";
import { FAREWELL_OPTIONS, type FarewellOptionId } from "../../domain/farewell";
import s from "./trial.module.css";

interface SceneAnswer {
  readonly fits: Partial<Record<FarewellOptionId, Fit>>;
  readonly reason: string;
}

interface Draft {
  readonly respondent: string;
  readonly scenes: Record<string, SceneAnswer>;
  readonly comment: string;
}

const DRAFT_KEY = "veteran-draft-v1";
const EMPTY: Draft = { respondent: "", scenes: {}, comment: "" };

let cachedRaw: string | null = null;
let cachedDraft: Draft | null = null;

function readSaved(): Draft | null {
  const raw = window.localStorage.getItem(DRAFT_KEY);
  if (raw === cachedRaw) return cachedDraft;
  cachedRaw = raw;
  try {
    cachedDraft = raw ? { ...EMPTY, ...(JSON.parse(raw) as Draft) } : null;
  } catch {
    cachedDraft = null;
  }
  return cachedDraft;
}

const noSubscribe = (): (() => void) => () => {};

function isComplete(answer: SceneAnswer | undefined): boolean {
  return FAREWELL_OPTIONS.every((o) => answer?.fits[o.id] !== undefined);
}

export function VeteranForm() {
  // 途中まで答えたものは、この端末に残しておく（閉じても続きから答えられる）
  const saved = useSyncExternalStore(noSubscribe, readSaved, () => null);
  const [edited, setEdited] = useState<Draft | null>(null);
  const draft = edited ?? saved ?? EMPTY;
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  const setDraft = (update: (d: Draft) => Draft): void => {
    const next = update(draft);
    setEdited(next);
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
  };

  const setFit = (sceneId: string, optionId: FarewellOptionId, fit: Fit): void => {
    setDraft((d) => {
      const current = d.scenes[sceneId] ?? { fits: {}, reason: "" };
      return { ...d, scenes: { ...d.scenes, [sceneId]: { ...current, fits: { ...current.fits, [optionId]: fit } } } };
    });
  };
  const setReason = (sceneId: string, reason: string): void => {
    setDraft((d) => {
      const current = d.scenes[sceneId] ?? { fits: {}, reason: "" };
      return { ...d, scenes: { ...d.scenes, [sceneId]: { ...current, reason } } };
    });
  };

  const done = SCENES.filter((scene) => isComplete(draft.scenes[scene.id])).length;

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/veteran/answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const body = (await res.json()) as { success: boolean; error?: string };
      if (!body.success) throw new Error(body.error ?? "送れませんでした");
      setStatus("sent");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "送れませんでした");
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)}>
      <label className={`${s.field} ${s.card}`}>
        お名前（仮の名前やイニシャルで構いません）
        <input
          className={s.input}
          value={draft.respondent}
          maxLength={40}
          required
          onChange={(e) => setDraft((d) => ({ ...d, respondent: e.target.value }))}
        />
      </label>

      <div className={s.progress} aria-live="polite">
        <span>
          答えた場面 {done} / {SCENES.length}
        </span>
        <button className={s.button} type="submit" disabled={status === "sending" || done === 0}>
          {status === "sending" ? "送っています…" : "ここまでの答えを送る"}
        </button>
      </div>

      {SCENES.map((scene) => {
        const answer = draft.scenes[scene.id];
        return (
          <section key={scene.id} className={s.scene} aria-labelledby={`scene-${scene.id}`}>
            <div className={s.sceneHead}>
              <span className={s.sceneId}>{scene.id}</span>
              <h2 id={`scene-${scene.id}`} className={s.sceneTitle}>
                {scene.title}
              </h2>
              <span className={s.sceneMeta}>
                故人 {scene.deceasedAge}歳{scene.daysUntilFuneral !== undefined ? `・葬儀まで${scene.daysUntilFuneral}日` : ""}
              </span>
            </div>
            <ul className={s.lines}>
              {scene.lines.map((line, i) => (
                <li key={i}>
                  <span className={s.speaker}>{line.label}</span>「{line.text}」
                </li>
              ))}
            </ul>
            {FAREWELL_OPTIONS.map((option) => (
              <div key={option.id} className={s.option}>
                <p className={s.optionLabel}>{option.label}</p>
                <fieldset className={s.choices}>
                  <legend className="sr-only">{`${scene.id} ${option.label}`}</legend>
                  {FITS.map((fit) => (
                    <label key={fit} className={s.choice}>
                      <input
                        type="radio"
                        name={`${scene.id}-${option.id}`}
                        checked={answer?.fits[option.id] === fit}
                        onChange={() => setFit(scene.id, option.id, fit)}
                      />
                      <span>{FIT_LABEL[fit]}</span>
                    </label>
                  ))}
                </fieldset>
              </div>
            ))}
            <label className={s.field}>
              なぜそう判断したか（一言で構いません）
              <textarea
                className={s.textarea}
                maxLength={600}
                value={answer?.reason ?? ""}
                onChange={(e) => setReason(scene.id, e.target.value)}
              />
            </label>
          </section>
        );
      })}

      <label className={`${s.field} ${s.card}`}>
        全体を通して、気になったこと・足りない選択肢など
        <textarea
          className={s.textarea}
          maxLength={2000}
          value={draft.comment}
          onChange={(e) => setDraft((d) => ({ ...d, comment: e.target.value }))}
        />
      </label>

      {status === "sent" && (
        <p className={s.done} role="status">
          受け取りました。ありがとうございます。直したところがあれば、もう一度送っていただいて構いません（最後に送ったものを使います）。
        </p>
      )}
      {status === "error" && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      <button className={s.button} type="submit" disabled={status === "sending" || done === 0}>
        答えを送る
      </button>
    </form>
  );
}
