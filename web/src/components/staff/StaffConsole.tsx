"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../client/api";
import { useCaseStream } from "../../client/useCaseStream";
import { impactedBy } from "../../domain/decisions";
import type { FarewellResult } from "../../engine/farewell";
import { DEMO_SCRIPT } from "../../engine/fixtures/demoScript";
import { DecisionBoard } from "./DecisionBoard";
import { FarewellPanel } from "./FarewellPanel";
import { Transcript } from "./Transcript";
import s from "./staff.module.css";

const LINE_INTERVAL_MS = 2800;

const message = (e: unknown): string => (e instanceof Error ? e.message : "問題が起きました");

export function StaffConsole({ caseId }: { readonly caseId: string }) {
  const { state, connected } = useCaseStream(caseId);
  const [playing, setPlaying] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [farewell, setFarewell] = useState<FarewellResult | null>(null);
  const [farewellLoading, setFarewellLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [impacted, setImpacted] = useState<ReadonlySet<string>>(new Set());
  /** 次に流す台本の行（描画には使わない。表示は案件の発話数から導く） */
  const step = useRef(0);
  useEffect(() => {
    if (state && !playing) step.current = state.utterances.length;
  }, [state, playing]);

  const runExtract = useCallback(async () => {
    setExtracting(true);
    try {
      await api.extract(caseId);
    } catch (e) {
      setError(message(e));
    } finally {
      setExtracting(false);
    }
  }, [caseId]);

  const runFarewell = useCallback(async () => {
    setFarewellLoading(true);
    setError(null);
    try {
      setFarewell(await api.farewell(caseId));
    } catch (e) {
      setError(message(e));
    } finally {
      setFarewellLoading(false);
    }
  }, [caseId]);

  const advance = useCallback(async (): Promise<boolean> => {
    const line = DEMO_SCRIPT[step.current];
    if (!line) return false;
    step.current += 1;
    try {
      await api.addUtterance(caseId, { ...line, at: step.current * 20 });
      void runExtract();
    } catch (e) {
      setError(message(e));
      return false;
    }
    return step.current < DEMO_SCRIPT.length;
  }, [caseId, runExtract]);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(async () => {
      const more = await advance();
      if (!more) {
        setPlaying(false);
        void runFarewell();
      }
    }, LINE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [playing, advance, runFarewell]);

  const confirm = async (decisionId: string, value: string): Promise<void> => {
    try {
      await api.confirm(caseId, decisionId, value);
      setImpacted(new Set(impactedBy(decisionId).map((d) => d.id)));
    } catch (e) {
      setError(message(e));
    }
  };

  const reset = async (): Promise<void> => {
    setPlaying(false);
    step.current = 0;
    setFarewell(null);
    setImpacted(new Set());
    setError(null);
    await api.reset(caseId);
  };

  if (!state) return <p className={s.empty} style={{ padding: "2rem" }}>読み込み中…</p>;
  const finished = state.utterances.length >= DEMO_SCRIPT.length;
  const recording = playing || (state.utterances.length > 0 && !finished);

  return (
    <div className={s.shell}>
      <header className={s.top}>
        <span className={s.family}>{state.familyName}</span>
        <span className={s.meta}>担当：新人（2年目）{connected ? "" : "／再接続中…"}</span>
        <span className={s.spacer} />
        <span className={`${s.rec} ${recording ? s.recOn : ""}`}>{recording ? "収録音声を再生中（デモ）" : "待機中"}</span>
        <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={() => setPlaying((p) => !p)} disabled={finished}>
          {playing ? "一時停止" : "▶ 打合せを再生"}
        </button>
        <button type="button" className={s.btn} onClick={() => void advance()} disabled={playing || finished}>
          1行すすめる
        </button>
        <button type="button" className={s.btn} onClick={() => void reset()}>
          最初から
        </button>
      </header>
      <div className={s.body}>
        <Transcript state={state} extracting={extracting} />
        <DecisionBoard state={state} impacted={impacted} onConfirm={(id, v) => void confirm(id, v)} />
        <FarewellPanel state={state} result={farewell} loading={farewellLoading} error={error} onRun={() => void runFarewell()} />
      </div>
    </div>
  );
}
