"use client";
import { useState, type FormEvent } from "react";
import { caseHref } from "../../domain/caseMode";
import type { CaseState } from "../../engine/case";
import { FAMILY_TASK_KINDS, FAMILY_TASK_LABEL, type FamilyTask, type FamilyTaskKind, type TaskAction } from "../../engine/familyTasks";
import type { MeetingReport } from "../../engine/report";
import c from "./console.module.css";
import b from "./records.module.css";

export type TaskHandler = (action: TaskAction) => Promise<boolean>;

interface RecordsViewProps {
  readonly caseId: string;
  readonly state: CaseState;
  readonly reports: readonly MeetingReport[] | null;
  readonly ending: boolean;
  readonly onTask: TaskHandler;
}

const jst = (ms: number): string => new Date(ms).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

/** お願いの1行：書き直す・ご家族に見せる・済み・消す */
function TaskRow({ task, onTask }: { readonly task: FamilyTask; readonly onTask: TaskHandler }) {
  const [editing, setEditing] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const text = String(new FormData(e.currentTarget).get("text") ?? "").trim();
    if (text && (await onTask({ action: "edit", id: task.id, text }))) setEditing(false);
  };
  return (
    <li className={[b.task, task.shared ? b.shared : "", task.done ? b.done : ""].join(" ")} data-testid={`task-${task.id}`}>
      <input type="checkbox" checked={task.done} onChange={(e) => void onTask({ action: "done", id: task.id, done: e.target.checked })} aria-label={`「${task.text}」を済みにする`} />
      {editing ? (
        <form className={b.taskEdit} onSubmit={(e) => void submit(e)}>
          <input name="text" defaultValue={task.text} maxLength={120} aria-label="お願いの内容" autoFocus />
          <button type="submit" className={b.small}>
            保存
          </button>
          <button type="button" className={b.ghost} onClick={() => setEditing(false)}>
            やめる
          </button>
        </form>
      ) : (
        <button type="button" className={b.taskText} onClick={() => setEditing(true)} aria-label={`「${task.text}」を書き直す`}>
          {task.text}
        </button>
      )}
      <label className={b.share}>
        <input type="checkbox" role="switch" checked={task.shared} onChange={(e) => void onTask({ action: "share", id: task.id, shared: e.target.checked })} />
        <span>{task.shared ? "ご家族に表示中" : "ご家族に見せる"}</span>
      </label>
      <button type="button" className={b.ghost} onClick={() => void onTask({ action: "remove", id: task.id })} aria-label={`「${task.text}」を消す`}>
        消す
      </button>
    </li>
  );
}

function AddTask({ kind, onTask }: { readonly kind: FamilyTaskKind; readonly onTask: TaskHandler }) {
  const submit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const form = e.currentTarget;
    const text = String(new FormData(form).get("text") ?? "").trim();
    if (text && (await onTask({ action: "add", kind, text, shared: false }))) form.reset();
  };
  return (
    <form className={b.addTask} onSubmit={(e) => void submit(e)}>
      <input name="text" placeholder="＋ 足す" maxLength={120} aria-label={`${FAMILY_TASK_LABEL[kind]}を足す`} />
    </form>
  );
}

/** ご家族へのお願い：記録から入った下書きを直して、ご家族の窓口に出す */
function FamilyTasks({ state, onTask }: { readonly state: CaseState; readonly onTask: TaskHandler }) {
  const tasks = state.familyTasks ?? [];
  return (
    <section className={b.tasks} aria-labelledby="family-tasks-title" data-testid="family-tasks">
      <h2 id="family-tasks-title" className={b.sectionTitle}>
        ご家族へのお願い
        <span className={b.badge}>{tasks.filter((t) => t.shared).length} 件を表示中</span>
      </h2>
      <div className={b.taskCols}>
        {FAMILY_TASK_KINDS.map((kind) => (
          <div key={kind} className={b.taskCol}>
            <h3>{FAMILY_TASK_LABEL[kind]}</h3>
            <ul className={b.taskList}>
              {tasks
                .filter((t) => t.kind === kind)
                .map((t) => (
                  <TaskRow key={t.id} task={t} onTask={onTask} />
                ))}
            </ul>
            <AddTask kind={kind} onTask={onTask} />
          </div>
        ))}
      </div>
    </section>
  );
}

function Items({ title, items }: { readonly title: string; readonly items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <div className={b.items}>
      <h4>{title}</h4>
      <ul>
        {items.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

/** 打合せをまたいで使う情報：ご家族へのお願いと、回ごとの記録（新しい回を上に） */
export function RecordsView({ caseId, state, reports, ending, onTask }: RecordsViewProps) {
  const list = [...(reports ?? [])].reverse();
  return (
    <div className={b.wrap} data-testid="records">
      <h1 className={c.viewTitle}>打合せの記録</h1>
      <FamilyTasks state={state} onTask={onTask} />
      <h2 className={b.sectionTitle}>回ごとの記録</h2>
      {ending && (
        <div className={b.skeleton} aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      )}
      {reports !== null && list.length === 0 && !ending && <p className={c.quiet}>まだ記録はありません。会話の欄の「打合せを終える」で残ります。</p>}
      <ol className={b.list}>
        {list.map((r) => (
          <li key={r.id} className={b.item} data-testid={`record-${r.number}`}>
            <div className={b.itemHead}>
              <b>第{r.number}回</b>
              <span className={b.when}>{jst(r.createdAt)}</span>
              <a className={b.open} href={caseHref(caseId, ["records", r.id].join("/"))} target="_blank" rel="noopener">
                記録を開く・印刷
              </a>
            </div>
            <p className={b.overview}>{r.overview}</p>
            <div className={b.grid}>
              <Items title="決まったこと" items={r.decided.map((d) => `${d.label}：${d.value}`)} />
              <Items title="これから決めること" items={r.toDecide} />
              <Items title="担当者がすること" items={r.staffTasks} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
