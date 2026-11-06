"use client";
import { useState } from "react";
import { FIT_LABEL } from "../../../data/judgmentScenes";
import { FAREWELL_OPTIONS } from "../../../domain/farewell";
import type { FitAnswer, SceneProgress, Verdict } from "./hearingDraft";
import s from "../trial.module.css";
import h from "./hearing.module.css";

const FIT_CHOICES: readonly { readonly value: FitAnswer; readonly label: string }[] = [
  { value: "suits", label: FIT_LABEL.suits },
  { value: "consider", label: FIT_LABEL.consider },
  { value: "not_now", label: FIT_LABEL.not_now },
  { value: "unknown", label: "わからない" },
];

const VERDICTS: readonly { readonly value: Verdict; readonly label: string }[] = [
  { value: "agree", label: "合っている" },
  { value: "disagree", label: "違う" },
  { value: "unsure", label: "どちらとも" },
];

interface WrapUpProps {
  readonly progress: SceneProgress;
  readonly busy: boolean;
  readonly error: string;
  readonly onChange: (fn: (p: SceneProgress) => SceneProgress) => void;
  readonly onExtract: () => void;
  readonly onSubmit: (comment: string) => void;
  readonly onBack: () => void;
}

/** 最後の30秒の見立て（推奨と比べるための固定の問い）と、取り出した判断の確認 */
export function WrapUp({ progress, busy, error, onChange, onExtract, onSubmit, onBack }: WrapUpProps) {
  const [comment, setComment] = useState("");
  const { stage } = progress;

  if (stage === "sent") {
    return (
      <div className={s.card}>
        <p className={s.done} role="status">
          この場面の答えを受け取りました。ありがとうございます。
        </p>
        <button type="button" className={s.button} onClick={onBack}>
          場面の一覧へ
        </button>
      </div>
    );
  }

  if (stage === "fits") {
    return (
      <div className={s.card}>
        <p className={h.stageTitle}>この家族に、4つのお別れの仕方はどうですか</p>
        <p className={h.stageLead}>いまの打合せのご家族について、直感で選んでください。迷うものは「わからない」で構いません。</p>
        {FAREWELL_OPTIONS.map((option) => (
          <div key={option.id} className={s.option}>
            <p className={s.optionLabel}>{option.label}</p>
            <fieldset className={`${s.choices} ${h.four}`}>
              <legend className="sr-only">{option.label}</legend>
              {FIT_CHOICES.map((c) => (
                <label key={c.value} className={s.choice}>
                  <input
                    type="radio"
                    name={`fit-${option.id}`}
                    checked={progress.fits[option.id] === c.value}
                    onChange={() => onChange((p) => ({ ...p, fits: { ...p.fits, [option.id]: c.value } }))}
                  />
                  <span>{c.label}</span>
                </label>
              ))}
            </fieldset>
          </div>
        ))}
        {error && (
          <p className={s.error} role="alert">
            {error}
          </p>
        )}
        <button type="button" className={s.button} style={{ marginTop: "1.25rem" }} onClick={onExtract} disabled={busy}>
          {busy ? "あなたの判断をまとめています…（30秒ほど）" : "次へ：あなたの判断のまとめを確かめる"}
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className={h.stageTitle}>あなたの判断として、合っていますか</p>
      <p className={h.stageLead}>
        打合せとふりかえりから、Claude が「こういうときは、こうする」を取り出しました。あなたの言葉をそのまま引いています。違うものは「違う」を押してください。合っているものだけを使います。
      </p>
      {progress.judgments.length === 0 && <p className={s.notice}>取り出せる判断がありませんでした。このまま送っていただいても、打合せの記録として使います。</p>}
      {progress.judgments.map((j, i) => (
        <article key={i} className={h.judgment}>
          <dl>
            <dt>こういうとき</dt>
            <dd>{j.when}</dd>
            <dt>こうする</dt>
            <dd>{j.do}</dd>
            {j.why && (
              <>
                <dt>理由</dt>
                <dd>{j.why}</dd>
              </>
            )}
          </dl>
          <blockquote>「{j.quote}」</blockquote>
          <fieldset className={s.choices}>
            <legend className="sr-only">{`まとめ ${i + 1} は合っているか`}</legend>
            {VERDICTS.map((v) => (
              <label key={v.value} className={s.choice}>
                <input
                  type="radio"
                  name={`verdict-${i}`}
                  checked={progress.verdicts[i] === v.value}
                  onChange={() => onChange((p) => ({ ...p, verdicts: { ...p.verdicts, [i]: v.value } }))}
                />
                <span>{v.label}</span>
              </label>
            ))}
          </fieldset>
          {progress.verdicts[i] === "disagree" && (
            <label className={s.field}>
              どこが違いますか（一言で）
              <input
                className={s.input}
                maxLength={600}
                value={progress.notes[i] ?? ""}
                onChange={(e) => onChange((p) => ({ ...p, notes: { ...p.notes, [i]: e.target.value } }))}
              />
            </label>
          )}
        </article>
      ))}
      <label className={`${s.field} ${s.card}`}>
        この場面について、ほかに伝えたいこと（任意）
        <textarea className={s.textarea} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} />
      </label>
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      <button type="button" className={s.button} onClick={() => onSubmit(comment)} disabled={busy}>
        {busy ? "送っています…" : "この場面の答えを送る"}
      </button>
    </div>
  );
}
