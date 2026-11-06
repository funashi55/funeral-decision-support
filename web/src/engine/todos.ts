/**
 * 担当者が自分で足すやること。決めることの一覧（domain/decisions.ts）にない用事を書き留め、済んだら印を付ける。
 * AI は足さない（担当者の手入力だけ）。
 */
import type { CaseState, CustomTodo } from "./case";

export const TODO_TEXT_MAX = 120;
export const TODOS_MAX = 50;

export class TodoInputError extends Error {}

export function todosOf(state: CaseState): readonly CustomTodo[] {
  return state.customTodos ?? [];
}

export function addTodo(state: CaseState, text: string, now: number): CaseState {
  const value = text.trim();
  if (!value) throw new TodoInputError("やることを入れてください");
  if (value.length > TODO_TEXT_MAX) throw new TodoInputError(`やることは${TODO_TEXT_MAX}文字までにしてください`);
  const todos = todosOf(state);
  if (todos.length >= TODOS_MAX) throw new TodoInputError("これ以上は足せません。済んだものを消してください");
  const nextNo = todos.reduce((max, t) => Math.max(max, Number(t.id.slice(1)) || 0), 0) + 1;
  return { ...state, customTodos: [...todos, { id: `T${nextNo}`, text: value, done: false, at: now }] };
}

export function setTodoDone(state: CaseState, id: string, done: boolean): CaseState {
  const todos = todosOf(state);
  if (!todos.some((t) => t.id === id)) throw new TodoInputError("そのやることは見つかりません");
  return { ...state, customTodos: todos.map((t) => (t.id === id ? { ...t, done } : t)) };
}

export function removeTodo(state: CaseState, id: string): CaseState {
  const todos = todosOf(state);
  if (!todos.some((t) => t.id === id)) throw new TodoInputError("そのやることは見つかりません");
  return { ...state, customTodos: todos.filter((t) => t.id !== id) };
}
