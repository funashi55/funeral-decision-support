"use client";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import s from "./guide.module.css";

export interface GuideStep {
  /** 照らす場所（data-guide の値） */
  readonly target: string;
  readonly title: string;
  readonly body: string;
}

interface Rect {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

const PAD = 6;
const BOX_W = 300;
const GAP = 12;

/** 見えている対象だけを数える（スマホで隠れている欄などは飛ばす） */
function findTarget(target: string): HTMLElement | null {
  const all = Array.from(document.querySelectorAll<HTMLElement>(`[data-guide="${target}"]`));
  return all.find((el) => el.getClientRects().length > 0 && el.offsetWidth > 0) ?? null;
}

/**
 * 画面のガイド。「？」ボタンで始め、関係する場所を照らして、そばに短い説明を出す。
 * 初めて開いた画面では一度だけ自動で始める（storageKey ごとに覚える）
 */
export function Guide({ steps, storageKey, label = "使い方", inline = false, autoStart = true }: { readonly steps: readonly GuideStep[]; readonly storageKey: string; readonly label?: string; readonly inline?: boolean; readonly autoStart?: boolean }) {
  const [index, setIndex] = useState<number | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);

  const visible = useCallback(() => steps.filter((st) => findTarget(st.target)), [steps]);
  const [shown, setShown] = useState<readonly GuideStep[]>([]);

  const start = useCallback(() => {
    const v = visible();
    if (v.length === 0) return;
    setShown(v);
    setIndex(0);
  }, [visible]);

  const stop = useCallback(() => {
    setIndex(null);
    try {
      localStorage.setItem(`guide:${storageKey}`, "1");
    } catch {
      // 覚えられなくても、ガイドは使える
    }
  }, [storageKey]);

  // 初めての画面では、表示が落ち着いてから一度だけ始める
  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(`guide:${storageKey}`) === "1";
    } catch {
      seen = true;
    }
    // 自動操作（テストや録画）のときは、勝手に始めない
    if (seen || !autoStart || navigator.webdriver) return;
    const t = window.setTimeout(start, 900);
    return () => window.clearTimeout(t);
  }, [start, storageKey, autoStart]);

  const step = index === null ? null : shown[index];

  // 照らす場所の位置を測る（スクロールや画面の大きさが変わったら測り直す）
  useLayoutEffect(() => {
    if (!step) return;
    const el = findTarget(step.target);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const measure = (): void => {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
    };
    measure();
    const t = window.setTimeout(measure, 350);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step]);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") stop();
      if (e.key === "ArrowRight") setIndex((i) => (i === null ? i : Math.min(i + 1, shown.length - 1)));
      if (e.key === "ArrowLeft") setIndex((i) => (i === null ? i : Math.max(i - 1, 0)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, shown.length, stop]);

  const last = index !== null && index === shown.length - 1;
  const box = boxPosition(rect);

  return (
    <>
      <button type="button" className={`${s.helpBtn} ${inline ? s.helpInline : ""}`} onClick={start} aria-label={`${label}のガイドを見る`} title={`${label}のガイド`}>
        ?
      </button>
      {step && rect && (
        <div className={s.layer} role="dialog" aria-modal="true" aria-labelledby="guide-title" aria-describedby="guide-body">
          <button type="button" className={s.backdrop} onClick={stop} aria-label="ガイドを閉じる" tabIndex={-1} />
          <div className={s.spot} style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} aria-hidden="true" />
          <div className={s.box} style={box}>
            <p className={s.count}>
              {(index ?? 0) + 1} / {shown.length}
            </p>
            <h2 id="guide-title" className={s.title}>
              {step.title}
            </h2>
            <p id="guide-body" className={s.body}>
              {step.body}
            </p>
            <div className={s.actions}>
              <button type="button" className={s.skip} onClick={stop}>
                閉じる
              </button>
              {index !== null && index > 0 && (
                <button type="button" className={s.prev} onClick={() => setIndex(index - 1)}>
                  戻る
                </button>
              )}
              <button type="button" className={s.next} onClick={() => (last ? stop() : setIndex((index ?? 0) + 1))} autoFocus>
                {last ? "はじめる" : "次へ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** 説明の箱を、照らした場所の下（入らなければ上）に置く。画面からはみ出さないように寄せる */
function boxPosition(rect: Rect | null): React.CSSProperties {
  if (!rect) return {};
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(BOX_W, vw - 24);
  const left = Math.min(Math.max(12, rect.left + rect.width / 2 - width / 2), vw - width - 12);
  const below = rect.top + rect.height + GAP;
  const fitsBelow = below + 190 < vh;
  return fitsBelow ? { width, left, top: below } : { width, left, bottom: Math.max(12, vh - rect.top + GAP) };
}
