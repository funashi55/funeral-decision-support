import { describe, expect, it } from "vitest";
import { DEMO_CASE } from "./fixtures/demoCase";
import { TodoInputError, addTodo, removeTodo, setTodoDone, todosOf } from "./todos";
import type { CaseState } from "./case";

const base: CaseState = { ...DEMO_CASE, customTodos: undefined };

describe("担当者が自分で足すやること", () => {
  it("前から保存されている案件（欄がない）にも足せる。番号は続きから振る", () => {
    const one = addTodo(base, "  親戚に到着時刻を確かめる ", 1);
    const two = addTodo(one, "遺影の写真を預かる", 2);
    expect(todosOf(two).map((t) => [t.id, t.text, t.done])).toEqual([
      ["T1", "親戚に到着時刻を確かめる", false],
      ["T2", "遺影の写真を預かる", false],
    ]);
  });

  it("済みにしたり戻したり、消したりできる。元の状態は書き換えない", () => {
    const one = addTodo(base, "親戚に到着時刻を確かめる", 1);
    const done = setTodoDone(one, "T1", true);
    expect(todosOf(done)[0]?.done).toBe(true);
    expect(todosOf(one)[0]?.done).toBe(false);
    expect(todosOf(removeTodo(done, "T1"))).toEqual([]);
  });

  it("空や長すぎる文、ない番号は受け付けない", () => {
    expect(() => addTodo(base, "  ", 1)).toThrow(TodoInputError);
    expect(() => addTodo(base, "あ".repeat(121), 1)).toThrow(TodoInputError);
    expect(() => setTodoDone(base, "T9", true)).toThrow(TodoInputError);
    expect(() => removeTodo(base, "T9")).toThrow(TodoInputError);
  });
});
