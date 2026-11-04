"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../client/api";
import { useCaseStream } from "../../client/useCaseStream";
import { impactedBy } from "../../domain/decisions";
import type { FeedbackVerdict } from "../../engine/case";
import type { FarewellResult } from "../../engine/farewell";
import { DEMO_SCRIPT } from "../../engine/fixtures/demoScript";
import { detectOversights } from "../../engine/oversight";
import { detectPhase } from "../../engine/phase";
import { DecisionBoard } from "./DecisionBoard";
import { FamilyInbox } from "./FamilyInbox";
import { FarewellPanel } from "./FarewellPanel";
import type { NewLine } from "./InputDock";
import { OrdersPanel } from "./OrdersPanel";
import { PhaseBar } from "./PhaseBar";
import { PlansPanel } from "./PlansPanel";
import { Transcript } from "./Transcript";
import s from "./staff.module.css";

const LINE_INTERVAL_MS = 2800;

type Tab = "farewell" | "plans" | "orders";
const TABS: readonly { readonly id: Tab; readonly label: string }[] = [
  { id: "farewell", label: "お別れの仕方" },
  { id: "plans", label: "プランの案" },
  { id: "orders", label: "手配と書き出し" },
];

const message = (e: unknown): string => (e instanceof Error ? e.message : "問題が起きました");

export function StaffConsole({ caseId }: { readonly caseId: string }) {
  const { state, connected } = useCaseStream(caseId);
  const [playing, setPlaying] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [farewell, setFarewell] = useState<FarewellResult | null>(null);
  const [farewellLoading, setFarewellLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [impacted, setImpacted] = useState<ReadonlySet<string>>(new Set());
  const [inboxOpen, setInboxOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("farewell");
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

  /** メモ入力やマイクの聞き取りで、発言を1つ足す（以降の処理は台本の再生と同じ） */
  const addLine = useCallback(
    async (line: NewLine): Promise<void> => {
      try {
        const at = state ? (state.utterances.at(-1)?.at ?? 0) + 20 : 0;
        await api.addUtterance(caseId, { ...line, at });
        void runExtract();
      } catch (e) {
        setError(message(e));
      }
    },
    [caseId, runExtract, state],
  );

  const editLine = async (utteranceId: string, text: string): Promise<void> => {
    try {
      await api.editUtterance(caseId, utteranceId, text);
      void runExtract();
    } catch (e) {
      setError(message(e));
    }
  };

  const feedback = async (target: string, verdict: FeedbackVerdict): Promise<void> => {
    try {
      await api.feedback(caseId, target, verdict);
    } catch (e) {
      setError(message(e));
    }
  };

  const familyLink = async (action: "revoke" | "reissue"): Promise<void> => {
    try {
      await api.familyLink(caseId, action);
    } catch (e) {
      setError(message(e));
    }
  };

  const acknowledge = async (requestId: string, reply: string | null): Promise<void> => {
    try {
      await api.acknowledge(caseId, requestId, reply);
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
  const openRequests = state.requests.filter((r) => r.status === "open").length;
  const recording = playing;
  const phase = detectPhase(state.utterances);
  const oversights = detectOversights(state);

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
        <button type="button" className={`${s.btn} ${s.inboxBtn}`} onClick={() => setInboxOpen((o) => !o)} aria-expanded={inboxOpen}>
          ご家族の窓口
          {openRequests > 0 && <span className={s.badge} aria-label={`未対応 ${openRequests} 件`}>{openRequests}</span>}
        </button>
        <button type="button" className={s.btn} onClick={() => void reset()}>
          最初から
        </button>
      </header>
      <PhaseBar reading={phase} />
      <div className={s.body}>
        <Transcript state={state} extracting={extracting} onAdd={addLine} onEdit={editLine} />
        <DecisionBoard
          state={state}
          impacted={impacted}
          onConfirm={(id, v) => void confirm(id, v)}
          oversights={oversights}
          onFeedback={(t, v) => void feedback(t, v)}
        />
        <section className={s.col} aria-label="推奨と手配">
          <div className={s.tabs} role="tablist" aria-label="推奨と手配">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          <div className={s.tabPanel} role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === "farewell" && (
              <FarewellPanel
                state={state}
                result={farewell}
                loading={farewellLoading}
                error={error}
                onRun={() => void runFarewell()}
                onFeedback={(t, v) => void feedback(t, v)}
              />
            )}
            {tab === "plans" && <PlansPanel state={state} phase={phase.phase} onFeedback={(t, v) => void feedback(t, v)} />}
            {tab === "orders" && <OrdersPanel state={state} />}
          </div>
        </section>
      </div>
      {inboxOpen && <FamilyInbox state={state} onClose={() => setInboxOpen(false)} onAcknowledge={acknowledge} onLink={familyLink} />}
    </div>
  );
}
