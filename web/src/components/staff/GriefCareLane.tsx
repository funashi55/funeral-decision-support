"use client";
import { getGriefPrinciple } from "../../domain/griefCare";
import type { CaseState } from "../../engine/case";
import type { FarewellRecommendation } from "../../engine/farewell";
import { useState, type FormEvent } from "react";
import c from "./console.module.css";
import b from "./buddy.module.css";

interface GriefCareLaneProps {
  readonly state: CaseState;
  readonly items: FarewellRecommendation["griefCare"];
  /** 項目ごとの操作（伝えた／使わない） */
  readonly actions?: (principleId: string) => React.ReactNode;
  /** 担当者が残した自分の言い方（考え方ごと） */
  readonly phrases?: Readonly<Record<string, readonly string[]>>;
  /** 自分の言い方を残す。残せたら true */
  readonly onSavePhrase?: (principleId: string, text: string) => Promise<boolean>;
}

/** 自分の言い方を残す小さな入力 */
function SavePhrase({ principleId, initial, onSave }: { readonly principleId: string; readonly initial: string; readonly onSave: (id: string, text: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!open)
    return (
      <button type="button" className={b.linkBtn} onClick={() => setOpen(true)}>
        ＋ 自分の言い方を残す
      </button>
    );
  const submit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const text = String(new FormData(e.currentTarget).get("phrase") ?? "").trim();
    if (!text) return;
    setBusy(true);
    const saved = await onSave(principleId, text);
    setBusy(false);
    if (saved) setOpen(false);
  };
  return (
    <form className={b.save} onSubmit={(e) => void submit(e)}>
      <input name="phrase" defaultValue={initial} aria-label="自分の言い方" maxLength={80} autoFocus />
      <button type="submit" className={b.saveBtn} disabled={busy}>
        残す
      </button>
      <button type="button" className={b.linkBtn} onClick={() => setOpen(false)}>
        やめる
      </button>
    </form>
  );
}

/**
 * ご遺族への配慮（グリーフケア）。会話から当てはまる考え方を選び、かける言葉の例を出す。
 * 理論・出典・避けたい言葉はサーバーではなく domain の固定の記述から出す。言葉は例で、使うかは担当者が決める
 */
export function GriefCareLane({ state, items, actions, phrases, onSavePhrase }: GriefCareLaneProps) {
  if (items.length === 0) return null;
  return (
    <div className={c.lane} data-testid="grief-care">
      {items.map((g) => {
        const p = getGriefPrinciple(g.principleId);
        const quote = state.utterances.find((u) => u.id === g.utteranceIds.at(-1));
        const mine = phrases?.[g.principleId]?.[0];
        return (
          <article key={g.principleId} className={c.care}>
            <div className={c.careHead}>
              <h4>{p.name}</h4>
              {actions?.(g.principleId)}
            </div>
            {mine && (
              <p className={b.mine} data-testid={`mine-${g.principleId}`}>
                <small>自分の言い方</small>「{mine}」
              </p>
            )}
            <p className={c.careWords}>
              <small>かける言葉の例</small>「{g.words}」
            </p>
            {onSavePhrase && <SavePhrase principleId={g.principleId} initial={g.words} onSave={onSavePhrase} />}
            <details className={c.careMore}>
              <summary>根拠・ほかの言い方・避けたい言葉</summary>
              <p className={c.careWhy}>
                {g.observation}
                {quote && <span className={c.careQuote}>（「{quote.text.slice(0, 24)}{quote.text.length > 24 ? "…" : ""}」）</span>}
              </p>
              <dl>
                <dt>考え方</dt>
                <dd>{p.principle}</dd>
                <dt>ほかの言い方</dt>
                <dd>
                  {p.sayExamples.map((w) => (
                    <span key={w} className={c.careSay}>「{w}」</span>
                  ))}
                </dd>
                <dt>避けたい言葉</dt>
                <dd>
                  <ul>
                    {p.avoid.map((a) => (
                      <li key={a.words}>
                        <s>「{a.words}」</s> — {a.why}
                      </li>
                    ))}
                  </ul>
                </dd>
                <dt>拠りどころ</dt>
                <dd>
                  {p.theory}
                  <br />
                  <cite>{p.source}</cite>
                </dd>
              </dl>
            </details>
          </article>
        );
      })}
    </div>
  );
}
