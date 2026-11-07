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
import { ConfirmControl, ManualEntry } from "./DecisionBoard";
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
  readonly onConfirm: (decisionId: string, value: string) => void;
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
export function NowView({ state, impacted, oversights, farewell, planFit, farewellBasedOn, planFitBasedOn, thinking, extracting, onConfirm, onTodo, onFeedback, children }: NowViewProps) {
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
  const alerts = oversights.filter((a) => active({ target: `oversight:${a.id}`, decisionId: a.decisionId, cues: TOPIC_CUES[a.decisionId], basedOn: after(a.utteranceIds) }, "注意", a.decisionLabel));
  // 推奨（AI）が一覧から選んだ注意。決まりごとが言い回しの違いで拾えなかったものを補う。同じ注意は重ねて出さない
  const aiCautions = (rec?.cautions ?? [])
    .filter((x) => !oversights.some((o) => o.id === x.id) && state.decisions[x.decisionId]?.status !== "confirmed")
    .filter((x) => active({ target: `oversight:${x.id}`, decisionId: x.decisionId, cues: TOPIC_CUES[x.decisionId], basedOn: farewellBasedOn }, "注意", x.label));
  const questions = (rec?.questionsToAsk ?? []).filter((q) => active(byWords(`question:${textKey(q)}`, q), "確認", q));
  const nowAlerts = alerts.filter((a) => !later(a.decisionId));
  const nowCautions = aiCautions.filter((x) => !later(x.decisionId));
  const laterChecks = [...alerts.filter((a) => later(a.decisionId)).map((a) => ({ key: `oversight:${a.id}`, label: a.decisionLabel, message: a.message })), ...aiCautions.filter((x) => later(x.decisionId)).map((x) => ({ key: `oversight:${x.id}`, label: x.label, message: x.message }))];
  const checkCount = nowAlerts.length + nowCautions.length + questions.length;
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
    { id: "info", label: "基本情報", count: state.circumstances.length },
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
          <BasicInfo state={state} />
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
            <p className={c.wishBand}>
              <small>
                ご家族が望んでいること
                {state.utterances.length - farewellBasedOn >= STALE_AFTER && <span className={c.staleTag}>{state.utterances.length - farewellBasedOn}発言前までの見立て</span>}
              </small>
              {rec.familyWish}
            </p>
          )}
          {care.length === 0 && !rec && <p className={c.quiet}>会話が進むと、かける言葉の例が出ます</p>}
          <GriefCareLane state={state} items={care} actions={(id) => <div className={c.itemActions}>{told(`care:${id}`)}</div>} />
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
                    </div>
                    <p className={c.raise}>
                      <small>こう切り出しましょう</small>「{o.howToRaise}」
                    </p>
                    <details className={c.why}>
                      <summary>なぜ</summary>
                      <p className={c.reason}>{o.reason}</p>
                    </details>
                    <div className={c.itemActions}>{told(`farewell:${o.id}`)}</div>
                  </li>
                ))}
              </ul>
              {showPlan && planFit && <PlanFitCard state={state} proposal={planFit} actions={<div className={c.itemActions}>{told("plan:fit")}</div>} />}
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
                  <li key={x.key}>
                    <b>{x.label}</b>
                    <span>{x.message}</span>
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
          {nowAlerts.map((a) => (
            <article key={a.id} className={c.alert}>
              <h4>
                <span className={c.tagWarn}>注意</span>
                {a.decisionLabel}
              </h4>
              <p>{a.message}</p>
              <div className={s.meta2}>
                {a.utteranceIds.length > 0 && (
                  <span className={s.tag}>きっかけ：「{state.utterances.find((u) => u.id === a.utteranceIds.at(-1))?.text.slice(0, 18)}…」</span>
                )}
                {told(`oversight:${a.id}`)}
              </div>
            </article>
          ))}
          {nowCautions.map((x) => (
            <article key={x.decisionId + x.message} className={c.alert}>
              <h4>
                <span className={c.tagWarn}>注意</span>
                {x.label}
              </h4>
              <p>{x.message}</p>
              <div className={c.itemActions}>{told(`oversight:${x.id}`)}</div>
            </article>
          ))}
          {questions.length > 0 && (
            <ul className={c.questions}>
              {questions.map((q) => (
                <li key={q}>
                  <span className={c.tagAsk}>確認</span>
                  {q}
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

/** 基本情報：登録で伺ったことと、ここまでに決まったこと */
function BasicInfo({ state }: { readonly state: CaseState }) {
  const r = state.registration;
  const decided = DECISIONS.filter((d) => state.decisions[d.id]?.status === "confirmed");
  const rows: readonly (readonly [string, string | undefined])[] = r
    ? [
        ["喪主", [r.chiefMourner.relation, r.chiefMourner.name].filter(Boolean).join("・")],
        ["喪主の電話", r.chiefMourner.phone],
        ["故人", [r.deceased.name, r.deceased.age !== undefined ? `${r.deceased.age}歳` : undefined, r.deceased.sex !== "答えない" ? r.deceased.sex : undefined].filter(Boolean).join("・")],
        ["亡くなった日時・場所", [r.deceased.diedAt?.replace("T", " "), r.deceased.diedPlace].filter(Boolean).join("・")],
        ["互助会", r.membership],
        ["受付のメモ", r.memo],
      ]
    : [["故人", state.profile.deceasedAge ? `${state.profile.deceasedAge}歳` : undefined], ["葬儀の形の希望", state.profile.funeralStyle]];
  const shown = rows.filter(([, v]) => v);
  return (
    <>
      <section aria-labelledby="registration-title" className={c.block}>
        <h2 id="registration-title" className={c.blockTitle}>
          受付で伺ったこと
        </h2>
        {shown.length === 0 ? (
          <p className={c.quiet}>まだありません</p>
        ) : (
          <dl className={c.infoList}>
            {shown.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        )}
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
  const total = today.length + customs.length;
  const finished = done.length + customs.filter((t) => t.done).length;
  return (
    <aside className={c.todo} aria-labelledby="todo-title">
      <h2 id="todo-title" className={c.blockTitle}>
        やることリスト
      </h2>
      <p className={c.todoCount}>
        残り <b>{total - finished}</b> / {total}
      </p>
      <div className={c.todoBar} aria-hidden="true">
        <i style={{ width: `${(finished / Math.max(total, 1)) * 100}%` }} />
      </div>

      {next.length > 0 && (
        <div className={c.nextBox} data-testid="next-steps">
          <h3 className={c.nextTitle}>次に進めること</h3>
          <ul className={c.todoList}>
            {next.map((n) => {
              const value = state.decisions[n.item.id]?.value;
              return (
                <li key={n.item.id} className={`${c.todoItem} ${c.nextItem}`}>
                  <span className={c.todoMark} aria-hidden="true">→</span>
                  <span className={c.todoText}>
                    {n.item.label}
                    <small className={c.nextReason}>{n.reason}</small>
                    {value && <small>候補：{value}</small>}
                  </span>
                  {n.kind === "confirm" && value ? <ConfirmControl item={n.item} value={value} onConfirm={onConfirm} /> : <ManualEntry item={n.item} onConfirm={onConfirm} />}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {waiting.length > 0 && (
        <>
          <h3 className={c.todoGroup}>確定を待つ {waiting.length}</h3>
          <ul className={c.todoList}>
            {waiting.map((d) => {
              const value = state.decisions[d.id]?.value;
              return (
                <li key={d.id} className={`${c.todoItem} ${c.todoWaiting} ${impacted.has(d.id) ? c.todoImpacted : ""}`}>
                  <span className={c.todoMark} aria-hidden="true">●</span>
                  <span className={c.todoText}>
                    {d.label}
                    <small>{impacted.has(d.id) ? "見直しが必要です" : value}</small>
                  </span>
                  {value ? <ConfirmControl item={d} value={value} onConfirm={onConfirm} /> : <ManualEntry item={d} onConfirm={onConfirm} />}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {open.length > 0 && (
        <>
          <h3 className={c.todoGroup}>まだ {open.length}</h3>
          <ul className={c.todoList}>
            {open.map((d) => (
              <li key={d.id} className={c.todoItem}>
                <span className={c.todoMark} aria-hidden="true">○</span>
                <span className={c.todoText}>{d.label}</span>
                <ManualEntry item={d} onConfirm={onConfirm} />
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className={c.todoGroup}>自分で足したこと {customs.length > 0 ? customs.length : ""}</h3>
      {customs.length > 0 && (
        <ul className={c.todoList}>
          {customs.map((t) => (
            <li key={t.id} className={`${c.todoItem} ${t.done ? c.todoDone : ""}`}>
              <button
                type="button"
                className={c.todoCheck}
                aria-pressed={t.done}
                aria-label={t.done ? `「${t.text}」を未済に戻す` : `「${t.text}」を済みにする`}
                onClick={() => onTodo({ action: "done", id: t.id, done: !t.done })}
              >
                {t.done ? "✓" : ""}
              </button>
              <span className={c.todoText}>{t.text}</span>
              <button type="button" className={c.todoRemove} aria-label={`「${t.text}」を消す`} onClick={() => onTodo({ action: "remove", id: t.id })}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <AddTodo onAdd={(text) => onTodo({ action: "add", text })} />

      {done.length > 0 && (
        <>
          <h3 className={c.todoGroup}>決まった {done.length}</h3>
          <ul className={c.todoList}>
            {done.map((d) => (
              <li key={d.id} className={`${c.todoItem} ${c.todoDone}`}>
                <span className={c.todoMark} aria-hidden="true">✓</span>
                <span className={c.todoText}>
                  {d.label}
                  <small>{state.decisions[d.id]?.value}</small>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}

/** 一覧にない用事を、自分で足す */
function AddTodo({ onAdd }: { readonly onAdd: (text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <form
      className={c.todoForm}
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        onAdd(text.trim());
        setText("");
      }}
    >
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
