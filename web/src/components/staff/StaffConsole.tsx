"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../client/api";
import { useCaseStream } from "../../client/useCaseStream";
import { impactedBy } from "../../domain/decisions";
import type { FeedbackVerdict } from "../../engine/case";
import type { FarewellResult } from "../../engine/farewell";
import { DEMO_SCRIPT } from "../../engine/fixtures/demoScript";
import { buildOrders } from "../../engine/orders";
import { detectOversights } from "../../engine/oversight";
import { allowsPrices, detectPhase } from "../../engine/phase";
import { speaksAboutBudget, type PlanFitResult } from "../../engine/planFit";
import { fitsChanged, type QuickFit } from "../../engine/quickFit";
import { Guide, type GuideStep } from "../guide/Guide";
import { roleplayHref } from "../system/links";
import { DecisionBoard } from "./DecisionBoard";
import { NowView, type TodoAction } from "./NowView";
import { FamilyInbox } from "./FamilyInbox";
import { FarewellPanel } from "./FarewellPanel";
import type { NewLine } from "./InputDock";
import { OrdersPanel } from "./OrdersPanel";
import { PlansPanel } from "./PlansPanel";
import { Transcript } from "./Transcript";
import c from "./console.module.css";
import s from "./staff.module.css";

const LINE_INTERVAL_MS = 2800;
/** 見立てが変わらなくても、理由を書いてからこの数だけ発言が増えたら書き直す */
const REWRITE_AFTER_LINES = 3;
/** プランの提案を書き直すまでの、ご家族の発言の数 */
const PLAN_REWRITE_AFTER = 3;

/** 打合せの画面のガイド（見えている場所だけを順に照らす） */
const CONSOLE_GUIDE: readonly GuideStep[] = [
  { target: "demo", title: "デモを再生", body: "架空の打合せの会話が流れます。実際の打合せでは、会話の欄に打つか、マイクで聞き取ります。" },
  { target: "now-tabs", title: "いま見ること", body: "寄り添い・提案、やること、基本情報を切り替えます。数字は残っている件数です。" },
  { target: "care", title: "まず、寄り添う", body: "ご遺族に安心して、心ゆくまでお別れしていただくための言葉の例です。提案より先に、ここから始めます。" },
  { target: "proposal", title: "提案は、信頼のあとで", body: "お気持ちを伺い、お別れの話に入ると開きます。見せるのは切り出し方だけ。理由は「なぜ」に畳んでいます。" },
  { target: "composer", title: "会話を入れる", body: "話したことを打つか、マイクで聞き取ります。担当者かご遺族かは自動で聞き分けます。違っていたら、発言の名前を押すと入れ替わります。" },
  { target: "nav", title: "画面の切り替え", body: "決めることの一覧、プランの見積もり、手配（発注書）に移れます。" },
  { target: "inbox", title: "ご家族の窓口", body: "ご家族のスマホで開くページのリンクと QR コード、ご家族からの質問がここに届きます。" },
];

type View = "now" | "decisions" | "plans" | "orders";
const VIEWS: readonly { readonly id: View; readonly label: string; readonly icon: string }[] = [
  { id: "now", label: "いま", icon: "M12 8v4l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" },
  { id: "decisions", label: "決めること", icon: "M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" },
  { id: "plans", label: "プランの案", icon: "M4 6h16M4 12h16M4 18h10" },
  { id: "orders", label: "手配と書き出し", icon: "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6ZM14 3v6h6M8 13h8M8 17h5" },
];

function Icon({ d }: { readonly d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const message = (e: unknown): string => (e instanceof Error ? e.message : "問題が起きました");

export function StaffConsole({ caseId }: { readonly caseId: string }) {
  const { state, connected } = useCaseStream(caseId);
  const [playing, setPlaying] = useState(false);
  // スマホでは「会話」と中央の画面を切り替えて見せる（広い画面では両方とも出ている）
  const [talkOpen, setTalkOpen] = useState(false);
  // スマホの「メニュー」（下のバーに入れないもの）
  const [menuOpen, setMenuOpen] = useState(false);
  // ログインしている担当者の名前（ログインの設定がなければ null のまま）
  const [staffName, setStaffName] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void api.me().then((me) => alive && setStaffName(me?.name ?? null));
    return () => {
      alive = false;
    };
  }, []);
  const [extracting, setExtracting] = useState(false);
  const [farewell, setFarewell] = useState<FarewellResult | null>(null);
  const [farewellLoading, setFarewellLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [impacted, setImpacted] = useState<ReadonlySet<string>>(new Set());
  const [inboxOpen, setInboxOpen] = useState(false);
  const [view, setView] = useState<View>("now");
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

  /**
   * プランの提案：費用の話ができる段階（お別れの仕方以降）に入ってから作り、ご家族の発言が増えたら書き直す。
   * 走っている間は重ねて呼ばない
   */
  const [planFit, setPlanFit] = useState<(PlanFitResult & { readonly basedOn?: number }) | null>(null);
  const planFitRunning = useRef(false);
  const planFitAt = useRef(0);
  // 作っている途中に新しい依頼が来たら、終わってから最新の会話でもう一度作る（費用の話を取りこぼさないように）
  const planFitQueued = useRef<number | null>(null);
  const runPlanFit = useCallback(
    async (familyLines: number): Promise<void> => {
      if (planFitRunning.current) {
        planFitQueued.current = familyLines;
        return;
      }
      planFitRunning.current = true;
      let lines: number | null = familyLines;
      try {
        while (lines !== null) {
          planFitAt.current = lines;
          planFitQueued.current = null;
          setPlanFit(await api.planFit(caseId));
          const queued: number | null = planFitQueued.current;
          lines = queued !== null && queued > planFitAt.current ? queued : null;
        }
      } catch (e) {
        setError(message(e));
      } finally {
        planFitRunning.current = false;
      }
    },
    [caseId],
  );
  const utterances = state?.utterances;
  useEffect(() => {
    if (!utterances || utterances.length === 0) return;
    if (!allowsPrices(detectPhase(utterances).phase)) return;
    const family = utterances.filter((u) => u.speaker !== "staff");
    const familyLines = family.length;
    // 費用についての気持ちが新しく出たら、3発言を待たずに書き直す（古い見立てで上の幅を勧めないように）
    const budgetJustSaid = familyLines > planFitAt.current && speaksAboutBudget(family.at(-1)?.text ?? "");
    if (planFitAt.current === 0 || budgetJustSaid || familyLines - planFitAt.current >= PLAN_REWRITE_AFTER) void runPlanFit(familyLines);
  }, [utterances, runPlanFit]);

  /** 理由づけ（推奨）がどの発言までを見て書かれたか */
  const [farewellBasedOn, setFarewellBasedOn] = useState(0);
  const farewellRunning = useRef(false);
  // 書いている途中に頼まれたら、終わってから最新の会話でもう一度書く（古い「望んでいること」を残さない）
  const farewellQueued = useRef(false);
  const runFarewell = useCallback(async () => {
    if (farewellRunning.current) {
      farewellQueued.current = true;
      return;
    }
    farewellRunning.current = true;
    setFarewellLoading(true);
    setError(null);
    try {
      do {
        farewellQueued.current = false;
        const result = await api.farewell(caseId);
        // 新しい案が守る線にかかって出せなかったときは、直前に出せた案を残す（画面から急に消さない）
        setFarewell((prev) => (result.ok || !prev?.ok ? result : prev));
        if (result.ok) setFarewellBasedOn(result.basedOn ?? 0);
      } while (farewellQueued.current);
    } catch (e) {
      setError(message(e));
    } finally {
      farewellRunning.current = false;
      setFarewellLoading(false);
    }
  }, [caseId]);

  // 画面を開いたら、最後に出した推奨を読み込む（再読み込みで消えないように）
  useEffect(() => {
    let alive = true;
    void api
      .recommendations(caseId)
      .then((saved) => {
        if (!alive) return;
        if (saved.farewell) {
          setFarewell(saved.farewell);
          if (saved.farewell.ok) setFarewellBasedOn(saved.farewell.basedOn);
        }
        if (saved.planFit) {
          setPlanFit(saved.planFit);
          planFitAt.current = Math.max(planFitAt.current, 1);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [caseId]);

  /**
   * 聞きながら考える：発言が入るたびに、事情の拾い上げ（Haiku）→ いまの見立て（Opus・約2秒）。
   * 見立てが前の理由づけから変わったら、理由と根拠（推奨）を裏で書き直す。
   * 走っている間に発言が増えたら、終わってからもう一度だけ回す（呼び出しをためない）
   */
  const [quick, setQuick] = useState<QuickFit | null>(null);
  const [listening, setListening] = useState(false);
  const listenRunning = useRef(false);
  const listenAgain = useRef(false);
  const reasonedFits = useRef<QuickFit["fits"] | null>(null);
  const reasonedAt = useRef(0);
  const listen = useCallback(async (): Promise<void> => {
    if (listenRunning.current) {
      listenAgain.current = true;
      return;
    }
    listenRunning.current = true;
    setListening(true);
    try {
      do {
        listenAgain.current = false;
        await runExtract();
        const next = await api.quickFit(caseId);
        setQuick(next);
        // 見立てが変わったとき、または理由を書いてから発言が十分に増えたときに、理由と根拠を書き直す
        const grown = next.basedOn - reasonedAt.current >= REWRITE_AFTER_LINES;
        if (fitsChanged(reasonedFits.current, next.fits) || grown) {
          reasonedFits.current = next.fits;
          reasonedAt.current = next.basedOn;
          void runFarewell();
        }
      } while (listenAgain.current);
    } catch (e) {
      setError(message(e));
    } finally {
      listenRunning.current = false;
      setListening(false);
    }
  }, [caseId, runExtract, runFarewell]);

  const advance = useCallback(async (): Promise<boolean> => {
    const line = DEMO_SCRIPT[step.current];
    if (!line) return false;
    step.current += 1;
    try {
      await api.addUtterance(caseId, { ...line, at: step.current * 20 });
      void listen();
    } catch (e) {
      setError(message(e));
      return false;
    }
    return step.current < DEMO_SCRIPT.length;
  }, [caseId, listen]);

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
        void listen();
      } catch (e) {
        setError(message(e));
      }
    },
    [caseId, listen, state],
  );

  const editLine = async (utteranceId: string, text: string): Promise<void> => {
    try {
      await api.editUtterance(caseId, utteranceId, text);
      void listen();
    } catch (e) {
      setError(message(e));
    }
  };

  const swapSpeaker = async (utteranceId: string, speaker: "staff" | "family"): Promise<void> => {
    try {
      await api.swapSpeaker(caseId, utteranceId, speaker);
      void listen();
    } catch (e) {
      setError(message(e));
    }
  };

  /** 「いま」から呼ぶ記録。会話で触れた提案を自動で記録するため、描画のたびに変わらない関数にする */
  const recordFeedback = useCallback(
    (target: string, verdict: FeedbackVerdict | "clear"): void => {
      api.feedback(caseId, target, verdict).catch((e: unknown) => setError(message(e)));
    },
    [caseId],
  );

  const todo = async (body: TodoAction): Promise<void> => {
    try {
      await api.todo(caseId, body);
    } catch (e) {
      setError(message(e));
    }
  };

  const feedback = async (target: string, verdict: FeedbackVerdict | "clear"): Promise<void> => {
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
    setPlanFit(null);
    planFitAt.current = 0;
    setQuick(null);
    setFarewellBasedOn(0);
    reasonedFits.current = null;
    reasonedAt.current = 0;
    setImpacted(new Set());
    setError(null);
    await api.reset(caseId);
  };

  /** 再生・一時停止。最後まで流したあとは、最初に戻してから流し直す */
  const togglePlay = async (): Promise<void> => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (state && state.utterances.length >= DEMO_SCRIPT.length) await reset();
    setPlaying(true);
  };

  if (!state) return <p className={s.empty} style={{ padding: "2rem" }}>読み込み中…</p>;
  const finished = state.utterances.length >= DEMO_SCRIPT.length;
  const openRequests = state.requests.filter((r) => r.status === "open").length;
  const recording = playing;
  const phase = detectPhase(state.utterances);
  const oversights = detectOversights(state);

  const readyOrders = buildOrders(state).filter((o) => o.status === "ready").length;
  // 左の帯の数字は「手配できる数」だけにする（いま・決めることの残りは、それぞれの画面の中で数える。数字がずれて見えないように）
  const badge: Record<View, number> = { now: 0, decisions: 0, plans: 0, orders: readyOrders };

  const farewellPanel = (
    <FarewellPanel
      state={state}
      result={farewell}
      resultBasedOn={farewellBasedOn}
      quick={quick}
      listening={listening}
      loading={farewellLoading}
      error={null}
      onRun={() => void runFarewell()}
      onFeedback={(t, v) => void feedback(t, v)}
    />
  );

  return (
    <div className={c.app} data-pane={talkOpen ? "talk" : "main"}>
      <nav className={c.rail} aria-label="画面の切り替え">
        <div className={c.brand}>
          <span className={c.brandFamily}>{state.familyName}</span>
          <span className={c.brandMeta}>{staffName ? `担当：${staffName}` : "担当：新人（2年目）"}</span>
          {!connected && <span className={c.reconnect}>再接続中…</span>}
        </div>
        <div className={c.navList} role="tablist" aria-orientation="vertical" aria-label="画面" data-guide="nav">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              id={`tab-${v.id}`}
              aria-selected={view === v.id && !talkOpen}
              aria-controls="main-view"
              className={`${c.navItem} ${v.id === "plans" || v.id === "orders" ? c.desktopOnly : ""}`}
              onClick={() => {
                setView(v.id);
                setTalkOpen(false);
              }}
            >
              <Icon d={v.icon} />
              <span>{v.label}</span>
              {badge[v.id] > 0 && <span className={`${c.navBadge} ${v.id === "now" ? c.navBadgeWarn : ""}`}>{badge[v.id]}</span>}
            </button>
          ))}
          <button type="button" className={`${c.navItem} ${c.mobileOnly}`} aria-pressed={talkOpen} onClick={() => setTalkOpen(true)}>
            <Icon d="M8 10h8M8 14h5M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12Z" />
            <span>会話</span>
          </button>
          <button type="button" className={`${c.navItem} ${c.mobileOnly}`} aria-expanded={menuOpen} aria-haspopup="dialog" onClick={() => setMenuOpen(true)}>
            <Icon d="M4 6h16M4 12h16M4 18h16" />
            <span>メニュー</span>
            {openRequests + badge.orders > 0 && <span className={`${c.navBadge} ${openRequests > 0 ? c.navBadgeWarn : ""}`}>{openRequests + badge.orders}</span>}
          </button>
        </div>
        <div className={c.railFoot}>
          <Link href="/staff" className={c.navItem} title="ご家族の一覧・新しいご家族の登録">
            <Icon d="M3 6h18M3 12h18M3 18h18" />
            <span>ご家族の一覧</span>
          </Link>
          <Link href={roleplayHref(caseId)} className={c.navItem} title="架空のご家族と打合せの練習をする">
            <Icon d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            <span>ロールプレイ</span>
          </Link>
          <button type="button" className={`${c.navItem} ${s.inboxBtn}`} onClick={() => setInboxOpen((o) => !o)} aria-expanded={inboxOpen} data-guide="inbox">
            <Icon d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            <span>ご家族の窓口</span>
            {openRequests > 0 && (
              <span className={`${c.navBadge} ${c.navBadgeWarn}`} aria-label={`未対応 ${openRequests} 件`}>
                {openRequests}
              </span>
            )}
          </button>
        </div>
      </nav>

      <div className={c.main}>
        <header className={c.topbar}>
          <div className={c.demo} role="group" aria-label="デモの操作" data-guide="demo">
            <span className={c.demoLabel}>デモ</span>
            <button type="button" className={`${s.btn} ${recording ? s.btnRec : s.btnPrimary}`} onClick={() => void togglePlay()}>
              {recording && <span className={s.recDot} aria-hidden="true" />}
              {playing ? "一時停止" : finished ? "↻ もう一度再生" : "▶ 打合せを再生"}
            </button>
            <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={() => void advance()} disabled={playing || finished}>
              1行すすめる
            </button>
            <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={() => void reset()}>
              最初から
            </button>
          </div>
          <Guide steps={CONSOLE_GUIDE} storageKey="console" label="打合せの画面" inline />
        </header>
        {error && (
          <p className={c.errorBar} role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} aria-label="閉じる">
              ×
            </button>
          </p>
        )}
        <main className={c.stage} id="main-view" role="tabpanel" aria-labelledby={`tab-${view}`}>
          {view === "now" && (
            <NowView
              state={state}
              impacted={impacted}
              thinking={farewellLoading || listening}
              extracting={extracting}
              onRecommend={() => void runFarewell()}
              oversights={oversights}
              farewell={farewell}
              planFit={planFit?.ok ? planFit.proposal : null}
              farewellBasedOn={farewellBasedOn}
              planFitBasedOn={planFit?.basedOn ?? 0}
              onConfirm={(id, v) => void confirm(id, v)}
              onTodo={(body) => void todo(body)}
              onFeedback={recordFeedback}
            >
              {farewellPanel}
            </NowView>
          )}
          {view === "decisions" && (
            <div className={c.view}>
              <DecisionBoard state={state} impacted={impacted} onConfirm={(id, v) => void confirm(id, v)} />
            </div>
          )}
          {view === "plans" && (
            <div className={c.view}>
              <h1 className={c.viewTitle}>プランの案</h1>
              <PlansPanel state={state} phase={phase.phase} planFit={planFit?.ok ? planFit.proposal : null} onFeedback={(t, v) => void feedback(t, v)} />
            </div>
          )}
          {view === "orders" && (
            <div className={c.view}>
              <h1 className={c.viewTitle}>手配と書き出し</h1>
              <OrdersPanel state={state} />
            </div>
          )}
        </main>
      </div>

      <aside className={c.live} aria-label="会話">
        <Transcript state={state} onAdd={addLine} onEdit={editLine} onSwapSpeaker={swapSpeaker} />
      </aside>
      {menuOpen && (
        <div className={c.sheetLayer} role="dialog" aria-modal="true" aria-label="メニュー" onKeyDown={(e) => e.key === "Escape" && setMenuOpen(false)}>
          <button type="button" className={c.sheetBackdrop} aria-label="メニューを閉じる" onClick={() => setMenuOpen(false)} />
          <div className={c.sheet}>
            <p className={c.sheetFamily}>{state.familyName}</p>
            <div className={c.sheetGrid}>
              {VIEWS.filter((v) => v.id === "plans" || v.id === "orders").map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={c.sheetItem}
                  onClick={() => {
                    setView(v.id);
                    setTalkOpen(false);
                    setMenuOpen(false);
                  }}
                >
                  <Icon d={v.icon} />
                  {v.label}
                  {badge[v.id] > 0 && <span className={c.navBadge}>{badge[v.id]}</span>}
                </button>
              ))}
              <button
                type="button"
                className={c.sheetItem}
                onClick={() => {
                  setInboxOpen(true);
                  setMenuOpen(false);
                }}
              >
                <Icon d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                ご家族の窓口
                {openRequests > 0 && <span className={`${c.navBadge} ${c.navBadgeWarn}`}>{openRequests}</span>}
              </button>
              <Link href="/staff" className={c.sheetItem}>
                <Icon d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
                ご家族の一覧
              </Link>
              <Link href={roleplayHref(caseId)} className={c.sheetItem}>
                <Icon d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                ロールプレイ
              </Link>
            </div>
          </div>
        </div>
      )}
      {inboxOpen && <FamilyInbox state={state} onClose={() => setInboxOpen(false)} onAcknowledge={acknowledge} onLink={familyLink} />}
    </div>
  );
}
