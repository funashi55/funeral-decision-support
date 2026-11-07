"use client";
import { useState, type FormEvent } from "react";
import { DECISIONS } from "../../domain/decisions";
import type { CaseState } from "../../engine/case";
import { FACT_KEYS, FACT_LABEL, factValue, type FactKey } from "../../engine/facts";
import { SEX_OPTIONS } from "../../engine/registration";
import c from "./console.module.css";
import f from "./facts.module.css";

export type FactHandler = (key: FactKey, value: string) => Promise<boolean>;

const shown = (key: FactKey, value: string): string => (key === "deceasedAge" ? `${value}歳` : key === "diedAt" ? value.replace("T", " ") : value);

/**
 * 受付の事実の1行。確定した値・会話から拾った候補・未登録のどれかを出し、その場で確定・書き直しができる。
 * 登録では家名だけが必須なので、ここで少しずつ埋まっていく
 */
function FactRow({ state, factKey, onFact }: { readonly state: CaseState; readonly factKey: FactKey; readonly onFact: FactHandler }) {
  const value = factValue(state.registration, factKey);
  const candidate = state.factCandidates?.[factKey];
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const label = FACT_LABEL[factKey];

  const save = async (v: string): Promise<void> => {
    setBusy(true);
    const okay = await onFact(factKey, v);
    setBusy(false);
    if (okay) setEditing(false);
  };
  const submit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const v = String(new FormData(e.currentTarget).get("value") ?? "").trim();
    if (v) void save(v);
  };

  return (
    <div data-testid={`fact-${factKey}`}>
      <dt>{label}</dt>
      <dd>
        {editing ? (
          <form className={f.edit} onSubmit={submit}>
            {factKey === "deceasedSex" ? (
              <select name="value" defaultValue={value ?? candidate?.value ?? ""} aria-label={label}>
                <option value="" disabled>
                  選ぶ
                </option>
                {SEX_OPTIONS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            ) : (
              <input
                name="value"
                aria-label={label}
                defaultValue={value ?? candidate?.value ?? ""}
                type={factKey === "diedAt" ? "datetime-local" : factKey === "deceasedAge" ? "number" : factKey === "mournerPhone" ? "tel" : "text"}
                inputMode={factKey === "deceasedAge" ? "numeric" : undefined}
                autoFocus
              />
            )}
            <button type="submit" className={f.primary} disabled={busy}>
              確定
            </button>
            <button type="button" className={f.ghost} onClick={() => setEditing(false)}>
              やめる
            </button>
          </form>
        ) : value ? (
          <span className={f.row}>
            <span>{shown(factKey, value)}</span>
            <button type="button" className={f.ghost} onClick={() => setEditing(true)} aria-label={`${label}を書き直す`}>
              直す
            </button>
          </span>
        ) : candidate ? (
          <span className={f.row}>
            <span className={f.candidate}>
              {shown(factKey, candidate.value)}
              <small>会話から</small>
            </span>
            <button type="button" className={f.primary} disabled={busy} onClick={() => void save(candidate.value)} aria-label={`${label}を「${candidate.value}」で確定する`}>
              確定
            </button>
            <button type="button" className={f.ghost} onClick={() => setEditing(true)}>
              直す
            </button>
          </span>
        ) : (
          <span className={f.row}>
            <span className={f.empty}>未登録</span>
            <button type="button" className={f.ghost} onClick={() => setEditing(true)} aria-label={`${label}を入れる`}>
              入れる
            </button>
          </span>
        )}
      </dd>
    </div>
  );
}

/** 基本情報：受付の事実（会話から埋まる）と、ここまでに決まったこと */
export function BasicInfo({ state, onFact }: { readonly state: CaseState; readonly onFact: FactHandler }) {
  const r = state.registration;
  const decided = DECISIONS.filter((d) => state.decisions[d.id]?.status === "confirmed");
  const mourner = state.decisions.chief_mourner;
  const waiting = FACT_KEYS.filter((k) => !factValue(r, k) && state.factCandidates?.[k]).length;
  return (
    <>
      <section aria-labelledby="registration-title" className={c.block}>
        <h2 id="registration-title" className={c.blockTitle}>
          受付の事実{waiting > 0 && <span className={c.factsCount}>候補 {waiting}</span>}
        </h2>
        <dl className={c.infoList}>
          <div>
            <dt>喪主</dt>
            <dd>
              {mourner ? (
                <span className={mourner.status === "candidate" ? f.candidate : undefined}>
                  {mourner.value}
                  {mourner.status === "candidate" && <small>会話から（決めることで確定）</small>}
                </span>
              ) : (
                <span className={f.empty}>未定（決めることの「喪主を誰にするか」で決めます）</span>
              )}
            </dd>
          </div>
          {FACT_KEYS.map((k) => (
            <FactRow key={k} state={state} factKey={k} onFact={onFact} />
          ))}
          {r?.memo && (
            <div>
              <dt>受付のメモ</dt>
              <dd>{r.memo}</dd>
            </div>
          )}
        </dl>
      </section>
      <section aria-labelledby="decided-title" className={c.block}>
        <h2 id="decided-title" className={c.blockTitle}>
          決まったこと{decided.length > 0 && <span className={c.factsCount}>{decided.length}</span>}
        </h2>
        {decided.length === 0 ? (
          <p className={c.quiet}>まだありません</p>
        ) : (
          <dl className={c.infoList}>
            {decided.map((d) => (
              <div key={d.id}>
                <dt>{d.label}</dt>
                <dd>{state.decisions[d.id]?.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    </>
  );
}
