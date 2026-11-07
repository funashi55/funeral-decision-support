"use client";
import { useState } from "react";
import { api } from "../../client/api";
import { FAMILY_TASK_KINDS, FAMILY_TASK_LABEL } from "../../engine/familyTasks";
import type { FamilyTaskView } from "../../engine/familyView";
import s from "./family.module.css";

/** 担当者からのお願い（調べていただくこと・ご用意いただくこと）。済んだら印を付けられる */
export function TaskList({
  token,
  tasks,
}: {
  readonly token: string;
  readonly tasks: readonly FamilyTaskView[];
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 押したらすぐに印を変え、送れなかったら戻す
  const [local, setLocal] = useState<Readonly<Record<string, boolean>>>({});
  if (tasks.length === 0) return null;
  const toggle = async (id: string, done: boolean): Promise<void> => {
    setBusy(id);
    setError(null);
    setLocal((m) => ({ ...m, [id]: done }));
    try {
      await api.familyTaskDone(token, id, done);
    } catch {
      setLocal((m) => ({ ...m, [id]: !done }));
      setError("うまく送れませんでした。もう一度押してください。");
    } finally {
      setBusy(null);
    }
  };
  return (
    <section
      className={s.section}
      aria-labelledby="tasks-title"
      data-testid="family-task-list"
    >
      <div className={s.sectionHead}>
        <h2 id="tasks-title">お願いしたいこと</h2>
      </div>
      {FAMILY_TASK_KINDS.map((kind) => {
        const list = tasks.filter((t) => t.kind === kind);
        if (list.length === 0) return null;
        return (
          <div key={kind} className={s.taskGroup}>
            <h3>{FAMILY_TASK_LABEL[kind]}</h3>
            <ul className={s.taskList}>
              {list.map((t) => {
                const done = local[t.id] ?? t.done;
                return (
                  <li key={t.id} className={done ? s.taskDone : undefined}>
                    <label>
                      <input
                        type="checkbox"
                        checked={done}
                        disabled={busy === t.id}
                        onChange={(e) => void toggle(t.id, e.target.checked)}
                      />
                      <span>{t.text}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      {error && (
        <p className={s.note} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
