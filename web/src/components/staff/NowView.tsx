import Image from "next/image";
import { useEffect, useState } from "react";
import { DECISIONS } from "../../domain/decisions";
import type { CaseState } from "../../engine/case";
import { nextSteps } from "../../engine/nextSteps";
import { allowsPrices, detectPhase } from "../../engine/phase";
import { TODO_TEXT_MAX, todosOf } from "../../engine/todos";
import type { FarewellResult } from "../../engine/farewell";
import type { OversightAlert } from "../../engine/oversight";
import { getGriefPrinciple } from "../../domain/griefCare";
import { FAREWELL_CUES, FAREWELL_DECISION, HANDLED_LABEL, PLAN_CUES, handledBy, keywordCues, keywordHits, textKey, type HandledBy, type HandledCheck } from "../../engine/handled";
import { TOPIC_CUES } from "../../engine/nextSteps";
import { BasicInfo, type FactHandler } from "./BasicInfo";
import { CheckIcon, TaskRow } from "./TaskBoard";
import t from "./tasks.module.css";
import { GriefCareLane } from "./GriefCareLane";
import { PlanFitCard } from "./PlanFitCard";
import { familyAskedForMore, familyWantsToSave, type PlanFitProposal } from "../../engine/planFit";
import { FeedbackButtons, type FeedbackHandler } from "./FeedbackButtons";
import c from "./console.module.css";
import s from "./staff.module.css";

interface NowViewProps {
  readonly state: CaseState;
  readonly impacted: ReadonlySet<string>;
  readonly oversights: readonly OversightAlert[];
  readonly farewell: FarewellResult | null;
  /** プランの見立て（費用の話ができる段階に入ってから出る） */
  readonly planFit: PlanFitProposal | null;
  /** 推奨・プランの提案が、何番目の発言までを見て出たか（そのあと担当者が触れたら済んだとみなす） */
  readonly farewellBasedOn: number;
  readonly planFitBasedOn: number;
  /** 推奨を考えている途中か */
  readonly thinking: boolean;
  /** 会話から家族の事情を拾い上げている途中か */
  readonly extracting: boolean;
  /** いまの会話から、寄り添いと提案を作る */
  readonly onRecommend: () => void;
  readonly onConfirm: (decisionId: string, value: string) => void;
  /** 受付の事実（故人のお名前など）の確定・書き直し。うまくいけば true */
  readonly onFact: FactHandler;
  /** 担当者が自分で足すやること（足す・済みにする・消す） */
  readonly onTodo: TodoHandler;
  readonly onFeedback: FeedbackHandler;
  /** お別れの仕方の詳しい比較と根拠（FarewellPanel）。畳んで置く */
  readonly children: React.ReactNode;
}

export type TodoAction = { readonly action: "add"; readonly text: string } | { readonly action: "done"; readonly id: string; readonly done: boolean } | { readonly action: "remove"; readonly id: string };
export type TodoHandler = (body: TodoAction) => void;

/** 提案を開く前に、ご家族についてわかっていたいことの数 */
const READY_FACTS = 3;

/** 見立てがこれだけ発言に遅れたら、古いことを示す */
const STALE_AFTER = 4;

/** 有料の選択肢・お金に関わる決めごと（信頼を得てから話す） */
const OFFER_DECISIONS: ReadonlySet<string> = new Set(["laying_in_style", "laying_in_date", "embalming", "resting_place", "altar_plan", "flower_color", "coffin", "meals", "return_gifts", "budget_scope", "estimate", "membership"]);

const FIT_TEXT = { suits: "合う", consider: "尋ねてみる" } as const;

/** 済んだ提案（画面の下に畳む） */
interface DoneItem {
  readonly target: string;
  readonly kind: string;
  readonly label: string;
  readonly by: HandledBy;
}

/**
 * 「いま」：打合せの最中に担当者が見る 1 枚。
 * 左に「この流れでの提案」と「確認・注意」、右に「やることリスト」（会話から自動で埋まり、残りが見える）。
 * 伝えた提案・確定した項目に関わる提案・会話で触れた提案は、下の「済んだこと」に畳む
 */
export function NowView({ state, impacted, oversights, farewell, planFit, farewellBasedOn, planFitBasedOn, thinking, extracting, onRecommend, onConfirm, onFact, onTodo, onFeedback, children }: NowViewProps) {
  const [tab, setTab] = useState<NowTab>("proposal");
  const rec = farewell?.ok ? farewell.recommendation : null;
  // 提案は、ご家族のお気持ち（ヒアリング）を伺い終えて、お別れの話に入ってから開く。
  // 「お別れ」という言葉だけで早く開かないよう、ご家族のことが3つ以上わかっていることも条件にする。一度開いたら閉じに戻さない
  const readyNow = allowsPrices(detectPhase(state.utterances).phase) && state.circumstances.length >= READY_FACTS;
  const [openedOnce, setOpenedOnce] = useState(false);
  if (readyNow && !openedOnce) setOpenedOnce(true);
  const proposalsReady = readyNow || openedOnce;
  // 有料の選択肢やお金に関わる注意は、提案と同じく信頼を得てから。それまでは提案と一緒に畳む
  const later = (decisionId: string): boolean => !proposalsReady && OFFER_DECISIONS.has(decisionId);
  const done: DoneItem[] = [];
  /** 済んでいれば done に積んで false、まだなら true */
  const active = (check: HandledCheck, kind: string, label: string): boolean => {
    const by = handledBy(state, check);
    if (by) done.push({ target: check.target, kind, label, by });
    return by === null;
  };

  const proposals = (rec?.options ?? [])
    .filter((o) => o.fit !== "not_now")
    .sort((a, b) => (a.fit === b.fit ? 0 : a.fit === "suits" ? -1 : 1))
    .filter((o) => active({ target: `farewell:${o.id}`, decisionId: FAREWELL_DECISION[o.id], cues: FAREWELL_CUES[o.id], basedOn: farewellBasedOn }, "提案", o.label));
  // 費用を抑えたいと話したご家族に、上の幅を勧める古い見立ては出さない（書き直しを待つ）
  const planFresh = planFit !== null && !(planFit.bestRange !== "simple" && familyWantsToSave(state) && !familyAskedForMore(state));
  const showPlan = planFresh && active({ target: "plan:fit", decisionId: "altar_plan", cues: PLAN_CUES, basedOn: planFitBasedOn }, "提案", "プラン");
  // 声かけ・尋ねることは、勧めた文の言葉が担当者の発言にいくつ重なるかで見る
  const byWords = (target: string, text: string): HandledCheck => {
    const cues = keywordCues(text);
    return { target, cues, minHits: keywordHits(cues), basedOn: farewellBasedOn };
  };
  const care = (rec?.griefCare ?? []).filter((g) => active({ ...byWords(`care:${g.principleId}`, g.words) }, "声かけ", getGriefPrinciple(g.principleId).name));
  // 注意は、きっかけの発言のあとに担当者がその話題に触れたら済んだとみなす
  // （担当者が自分で話題にした発言はきっかけに数えない。きっかけがご家族の発言にないときは、最初から見る）
  const after = (ids: readonly string[]): number => {
    const first = state.utterances.findIndex((u) => u.speaker !== "staff" && ids.includes(u.id));
    return first >= 0 ? first + 1 : 1;
  };
  const alerts = oversights.filter((a) => active({ target: `oversight:${a.id}`, decisionId: a.decisionId, cues: TOPIC_CUES[a.decisionId], basedOn: after(a.utteranceIds) }, "注意", a.title));
  // 推奨（AI）が一覧から選んだ注意。決まりごとが言い回しの違いで拾えなかったものを補う。同じ注意は重ねて出さない
  const aiCautions = (rec?.cautions ?? [])
    .filter((x) => !oversights.some((o) => o.id === x.id) && state.decisions[x.decisionId]?.status !== "confirmed")
    .filter((x) => active({ target: `oversight:${x.id}`, decisionId: x.decisionId, cues: TOPIC_CUES[x.decisionId], basedOn: farewellBasedOn }, "注意", x.label));
  const questions = (rec?.questionsToAsk ?? []).filter((q) => active(byWords(`question:${textKey(q)}`, q), "確認", q));
  const nowAlerts = alerts.filter((a) => !later(a.decisionId));
  const nowCautions = aiCautions.filter((x) => !later(x.decisionId));
  const laterChecks = [...alerts.filter((a) => later(a.decisionId)).map((a) => ({ key: `oversight:${a.id}`, label: a.title, message: a.message })), ...aiCautions.filter((x) => later(x.decisionId)).map((x) => ({ key: `oversight:${x.id}`, label: x.label, message: x.message }))];
  // 取り消せないもの（must）だけを上に出し、ほかは「ほかに確かめること」に畳む（打合せ中に画面を見続けなくて済むように）
  const mustItems = [...nowAlerts.filter((a) => a.level === "must").map((a) => ({ key: `oversight:${a.id}`, title: a.title, message: a.message, quote: a.utteranceIds.at(-1) })), ...nowCautions.filter((x) => x.level === "must").map((x) => ({ key: `oversight:${x.id}`, title: x.label, message: x.message, quote: undefined }))];
  const checkItems = [...nowAlerts.filter((a) => a.level !== "must").map((a) => ({ key: `oversight:${a.id}`, title: a.title, message: a.message, quote: a.utteranceIds.at(-1) })), ...nowCautions.filter((x) => x.level !== "must").map((x) => ({ key: `oversight:${x.id}`, title: x.label, message: x.message, quote: undefined }))];
  const checkCount = mustItems.length + checkItems.length + questions.length;
  const told = (target: string): React.ReactNode => <FeedbackButtons state={state} target={target} onFeedback={onFeedback} />;
  // 会話で触れた提案・注意・尋ねることは「伝えた」として記録に残す（推奨が書き直されても戻らないように）
  const spoken = done.filter((d) => d.by === "spoken").map((d) => d.target);
  const spokenKey = spoken.join("|");
  useEffect(() => {
    if (spokenKey) for (const t of spokenKey.split("|")) onFeedback(t, "told");
  }, [spokenKey, onFeedback]);

  const remaining = todoRemaining(state);

  const tabs: readonly { readonly id: NowTab; readonly label: string; readonly count: number }[] = [
    { id: "proposal", label: "寄り添い・提案", count: checkCount },
    { id: "todo", label: "やること", count: remaining },
    // 会話から拾った受付の事実の候補（確かめて確定するもの）の数
    { id: "info", label: "基本情報", count: Object.keys(state.factCandidates ?? {}).length },
  ];

  return (
    <div className={`${c.view} ${c.wide}`}>
      <div className={c.nowTabs} role="tablist" aria-label="いまの画面" data-guide="now-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`now-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`now-panel-${t.id}`}
            className={c.nowTab}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.count > 0 && <span className={c.nowTabCount}>{t.count}</span>}
            {t.id === "proposal" && thinking && <span className={c.nowTabDot} aria-label="考えています" />}
            {t.id === "info" && extracting && <span className={c.nowTabDot} aria-label="整理中" />}
          </button>
        ))}
      </div>

      {tab === "todo" && (
        <div role="tabpanel" id="now-panel-todo" aria-labelledby="now-tab-todo" className={c.nowPanel}>
          <TodoList state={state} impacted={impacted} oversights={oversights} onConfirm={onConfirm} onTodo={onTodo} />
        </div>
      )}
      {tab === "info" && (
        <div role="tabpanel" id="now-panel-info" aria-labelledby="now-tab-info" className={`${c.nowPanel} ${c.nowMain}`}>
          <Facts state={state} extracting={extracting} />
          <BasicInfo state={state} onFact={onFact} />
        </div>
      )}
      <div role="tabpanel" id="now-panel-proposal" aria-labelledby="now-tab-proposal" className={`${c.nowPanel} ${c.nowMain}`} hidden={tab !== "proposal"}>
        {/* まず寄り添う：ご遺族への配慮を一番上に。安心してお別れしていただけてから、提案に進む */}
        <section aria-labelledby="care-title" className={c.block} data-guide="care">
          <h2 id="care-title" className={c.blockTitle}>
            まず、寄り添う
            {thinking && <span className={c.thinking}>考えています…</span>}
          </h2>
          {rec && (
            <div className={c.wishBand}>
              <small>
                ご家族が望んでいること
                {state.utterances.length - farewellBasedOn >= STALE_AFTER && <span className={c.staleTag}>{state.utterances.length - farewellBasedOn}発言前までの見立て</span>}
              </small>
              <FirstSentence text={rec.familyWish} />
            </div>
          )}
          {care.length === 0 && !rec && state.utterances.length === 0 && (
            <div className={c.careEmpty}>
              {/* 架空の絵：まず座って、お話を聴く */}
              <Image src="/images/web/care-tea.webp" width={96} height={96} alt="" aria-hidden="true" />
              <p>
                まず座って、お話を伺いましょう。
                <br />
                会話が進むと、かける言葉の例が出ます。
              </p>
            </div>
          )}
          {!rec && !thinking && state.utterances.length > 0 && (
            <p className={c.quiet}>
              {farewell && !farewell.ok ? "言い回しが守る線にかかったため、今回は出していません（選択肢の事実は「提案」の比較から見られます）。" : "まだ作っていません。"}
              <button type="button" className={c.inlineAction} onClick={onRecommend}>
                {farewell && !farewell.ok ? "もう一度作る" : "いまの会話から作る"}
              </button>
            </p>
          )}
          <GriefCareLane state={state} items={care} actions={(id) => <div className={c.headActions}>{told(`care:${id}`)}</div>} />
        </section>

        <details className={`${c.block} ${c.proposalFold}`} open={proposalsReady || undefined} data-guide="proposal" key={proposalsReady ? "ready" : "early"}>
          <summary>
            <h2 id="proposal-title" className={c.blockTitle}>
              提案
              {proposals.length + (showPlan ? 1 : 0) > 0 && <span className={c.laneCount}>{proposals.length + (showPlan ? 1 : 0)}</span>}
            </h2>
            {!proposalsReady && <span className={c.earlyTag}>お気持ちを伺ってから</span>}
          </summary>
          {!rec && <p className={c.quiet}>会話が進むと、ここに提案が出ます</p>}
          {rec && (
            <>
              <ul className={c.proposals}>
                {proposals.map((o) => (
                  <li key={o.id} className={c.proposal}>
                    <div className={c.proposalHead}>
                      <b>{o.label}</b>
                      <span className={o.fit === "suits" ? c.fitSuits : c.fitAsk}>{FIT_TEXT[o.fit as keyof typeof FIT_TEXT]}</span>
                      <div className={c.headActions}>{told(`farewell:${o.id}`)}</div>
                    </div>
                    <p className={c.raise}>
                      <small>こう切り出しましょう</small>「{o.howToRaise}」
                    </p>
                    <details className={c.why}>
                      <summary>なぜ</summary>
                      <p className={c.reason}>{o.reason}</p>
                    </details>
                  </li>
                ))}
              </ul>
              {showPlan && planFit && <PlanFitCard state={state} proposal={planFit} actions={<div className={c.headActions}>{told("plan:fit")}</div>} />}
              {rec.timeAdvice && (
                <details className={c.why}>
                  <summary>日程について</summary>
                  <p className={c.reason}>{rec.timeAdvice}</p>
                </details>
              )}
            </>
          )}
          {laterChecks.length > 0 && (
            <div className={c.laterChecks}>
              <h3>提案のときに確かめること</h3>
              <ul>
                {laterChecks.map((x) => (
                  <li key={x.key} className={c.compact}>
                    <details>
                      <summary>{x.label}</summary>
                      <p>{x.message}</p>
                    </details>
                    <div className={c.itemActions}>{told(x.key)}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <details className={c.more}>
            <summary>選択肢の比較と根拠をすべて見る</summary>
            {children}
          </details>
        </details>

        <section aria-labelledby="check-title" className={c.block} data-testid="oversights">
          <h2 id="check-title" className={c.blockTitle}>
            確認・注意<span className={c.laneCount}>{checkCount}</span>
          </h2>
          {checkCount === 0 && <p className={c.quiet}>いまはありません</p>}
          {/* 見出しだけを出し、説明は開いたときだけ見せる（打合せ中は画面を読み込まずに済むように） */}
          {mustItems.map((x) => (
            <article key={x.key} className={`${c.alert} ${c.compact}`}>
              <details>
                <summary>
                  <span className={c.tagWarn}>注意</span>
                  {x.title}
                </summary>
                <p>{x.message}</p>
                {x.quote && <span className={s.tag}>きっかけ：「{state.utterances.find((u) => u.id === x.quote)?.text.slice(0, 18)}…」</span>}
              </details>
              <div className={c.itemActions}>{told(x.key)}</div>
            </article>
          ))}
          {checkItems.length > 0 && (
            <details className={c.checkFold}>
              <summary>
                ほかに確かめること<span className={c.laneCount}>{checkItems.length}</span>
              </summary>
              <ul>
                {checkItems.map((x) => (
                  <li key={x.key} className={c.compact}>
                    <details>
                      <summary>{x.title}</summary>
                      <p>{x.message}</p>
                    </details>
                    <div className={c.itemActions}>{told(x.key)}</div>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {questions.length > 0 && (
            <ul className={c.questions}>
              {questions.map((q) => (
                <li key={q} className={c.compact}>
                  <p className={c.askLine}>
                    <span className={c.tagAsk}>確認</span>
                    {q}
                  </p>
                  <div className={c.itemActions}>{told(`question:${textKey(q)}`)}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {done.length > 0 && (
          <details className={c.doneBox} data-testid="handled">
            <summary>
              済んだこと<span className={c.laneCount}>{done.length}</span>
            </summary>
            <ul>
              {done.map((d) => (
                <li key={d.target}>
                  <span className={c.doneKind}>{d.kind}</span>
                  <span className={c.doneLabel}>{d.label}</span>
                  <span className={c.doneBy}>{HANDLED_LABEL[d.by]}</span>
                  {(d.by === "told" || d.by === "unused") && (
                    <button type="button" className={c.doneUndo} onClick={() => onFeedback(d.target, "clear")}>
                      戻す
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}

type NowTab = "proposal" | "todo" | "info";

/** やることの残り（今日決める項目と、自分で足したやること） */
function todoRemaining(state: CaseState): number {
  const today = DECISIONS.filter((d) => d.urgency === "today");
  const customs = todosOf(state);
  return today.filter((d) => state.decisions[d.id]?.status !== "confirmed").length + customs.filter((t) => !t.done).length;
}

/**
 * 今日決めることを打合せの順に並べる。会話から候補が入ると上がり、確定すると ✓ が付く。
 * まだの項目は手でも入れられ、一覧にない用事は自分で足せる
 */
function TodoList({ state, impacted, oversights, onConfirm, onTodo }: Pick<NowViewProps, "state" | "impacted" | "oversights" | "onConfirm" | "onTodo">) {
  const today = DECISIONS.filter((d) => d.urgency === "today");
  const done = today.filter((d) => state.decisions[d.id]?.status === "confirmed");
  // 会話の流れで、いま進めるとよい項目を上に押し上げる（下の一覧には重ねて出さない）
  const next = nextSteps(state, oversights);
  const pushed = new Set(next.map((n) => n.item.id));
  const waiting = DECISIONS.filter((d) => !pushed.has(d.id) && (state.decisions[d.id]?.status === "candidate" || (impacted.has(d.id) && state.decisions[d.id]?.status !== "confirmed")));
  const open = today.filter((d) => !pushed.has(d.id) && !state.decisions[d.id] && !impacted.has(d.id));
  const customs = todosOf(state);
  const customOpen = customs.filter((x) => !x.done);
  const customDone = customs.filter((x) => x.done);
  const total = today.length + customs.length;
  const finished = done.length + customDone.length;
  const section = (title: string, count: number, children: React.ReactNode, extra?: string) => (
    <details className={`${t.section} ${extra ?? ""}`} open>
      <summary>
        <span className={t.chevron} aria-hidden="true" />
        {title}
        <span className={t.sectionCount}>{count}</span>
      </summary>
      <ul className={t.list}>{children}</ul>
    </details>
  );
  return (
    <section className={t.board} aria-labelledby="todo-title">
      <header className={t.head}>
        <h2 id="todo-title">やること</h2>
        <p className={t.progress}>
          残り <b>{total - finished}</b>/{total}
          <span className={t.bar} aria-hidden="true">
            <i style={{ width: `${(finished / Math.max(total, 1)) * 100}%` }} />
          </span>
        </p>
      </header>

      {next.length > 0 && (
        <div data-testid="next-steps">
          {section(
            "次に進めること",
            next.length,
            next.map((n) => <TaskRow key={n.item.id} item={n.item} state={state} impacted={impacted.has(n.item.id)} onConfirm={onConfirm} note={n.reason} />),
            t.nextSection,
          )}
        </div>
      )}
      {waiting.length > 0 && section("確定を待つ", waiting.length, waiting.map((d) => <TaskRow key={d.id} item={d} state={state} impacted={impacted.has(d.id)} onConfirm={onConfirm} />))}
      {open.length > 0 && section("今日まだ", open.length, open.map((d) => <TaskRow key={d.id} item={d} state={state} impacted={false} onConfirm={onConfirm} />))}

      {section(
        "自分で足したこと",
        customOpen.length,
        <>
          {customOpen.map((x) => (
            <li key={x.id} className={t.row}>
              <button type="button" className={t.check} aria-pressed={false} aria-label={`「${x.text}」を済みにする`} onClick={() => onTodo({ action: "done", id: x.id, done: true })}>
                <CheckIcon />
              </button>
              <span className={t.body}>
                <span className={t.title}>{x.text}</span>
              </span>
              <button type="button" className={t.edit_btn} aria-label={`「${x.text}」を消す`} title="消す" onClick={() => onTodo({ action: "remove", id: x.id })}>
                ×
              </button>
            </li>
          ))}
          <li className={t.addRow}>
            <AddTodo onAdd={(text) => onTodo({ action: "add", text })} />
          </li>
        </>,
      )}

      {done.length + customDone.length > 0 && (
        <details className={`${t.section} ${t.doneSection}`}>
          <summary>
            <span className={t.chevron} aria-hidden="true" />
            完了
            <span className={t.sectionCount}>{done.length + customDone.length}</span>
          </summary>
          <ul className={t.list}>
            {done.map((d) => (
              <li key={d.id} className={`${t.row} ${t.rowDone}`}>
                <span className={`${t.check} ${t.checkDone}`} aria-hidden="true">
                  <CheckIcon />
                </span>
                <span className={t.body}>
                  <span className={t.title}>{d.label}</span>
                  <span className={t.meta}>{state.decisions[d.id]?.value}</span>
                </span>
              </li>
            ))}
            {customDone.map((x) => (
              <li key={x.id} className={`${t.row} ${t.rowDone}`}>
                <button type="button" className={`${t.check} ${t.checkDone}`} aria-pressed aria-label={`「${x.text}」を未済に戻す`} onClick={() => onTodo({ action: "done", id: x.id, done: false })}>
                  <CheckIcon />
                </button>
                <span className={t.body}>
                  <span className={t.title}>{x.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/** 一覧にない用事を、自分で足す */
function AddTodo({ onAdd }: { readonly onAdd: (text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <form
      className={t.addForm}
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        onAdd(text.trim());
        setText("");
      }}
    >
      <span className={t.plus} aria-hidden="true">＋</span>
      <input aria-label="やることを足す" placeholder="やることを足す（例：親戚に到着時刻を確かめる）" value={text} maxLength={TODO_TEXT_MAX} onChange={(e) => setText(e.target.value)} />
      <button type="submit" disabled={!text.trim()}>
        足す
      </button>
    </form>
  );
}

/** わかったことを最初から見せる数（多いときは古いものを畳む） */
const FACTS_SHOWN = 8;

/** わかったこと：ご遺族の言葉から拾い上げた家族の事情。新しいものを先に、文として読める大きさで並べる */
function Facts({ state, extracting }: { readonly state: CaseState; readonly extracting: boolean }) {
  const facts = [...state.circumstances].reverse();
  return (
    <section aria-labelledby="facts-title" className={c.block} aria-live="polite">
      <h2 id="facts-title" className={c.blockTitle}>
        わかったこと
        {facts.length > 0 && <span className={c.factsCount}>{facts.length}</span>}
        {extracting && <span className={c.thinking}>整理中…</span>}
      </h2>
      {facts.length === 0 ? (
        <p className={c.quiet}>会話から拾った事情がここに並びます</p>
      ) : (
        <>
          <ul className={c.facts}>
            {facts.slice(0, FACTS_SHOWN).map((f, i) => (
              <li key={f.id} className={i === 0 ? c.factNew : undefined}>
                {f.text}
              </li>
            ))}
          </ul>
          {facts.length > FACTS_SHOWN && (
            <details className={c.factsMore}>
              <summary>ほかに {facts.length - FACTS_SHOWN} 件</summary>
              <ul className={c.facts}>
                {facts.slice(FACTS_SHOWN).map((f) => (
                  <li key={f.id}>{f.text}</li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}

/** 最初の一文だけを出し、続きは開いたときに見せる（必要最小限を標準に） */
function FirstSentence({ text }: { readonly text: string }) {
  const cut = text.indexOf("。");
  if (cut < 0 || cut === text.length - 1) return <>{text}</>;
  return (
    <details className={c.moreText}>
      <summary>{text.slice(0, cut + 1)}</summary>
      {text.slice(cut + 1)}
    </details>
  );
}
