import { z } from "zod";
import { appendAudit } from "../../../../../engine/audit";
import { TODO_TEXT_MAX, TodoInputError, addTodo, removeTodo, setTodoDone } from "../../../../../engine/todos";
import { store } from "../../../../../server/store";
import { fail, handleError, ok } from "../../../../../server/http";

const BodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add"), text: z.string().max(TODO_TEXT_MAX * 2) }),
  z.object({ action: z.literal("done"), id: z.string().max(10), done: z.boolean() }),
  z.object({ action: z.literal("remove"), id: z.string().max(10) }),
]);

/** 担当者が自分で足すやること（足す・済みにする・消す）。AI からは呼ばない */
export async function POST(req: Request, ctx: RouteContext<"/api/cases/[caseId]/todos">): Promise<Response> {
  try {
    const { caseId } = await ctx.params;
    const state = await store.get(caseId);
    if (!state) return fail("案件が見つかりません", 404);
    const body = BodySchema.parse(await req.json());
    const now = Date.now();
    const next =
      body.action === "add" ? addTodo(state, body.text, now) : body.action === "done" ? setTodoDone(state, body.id, body.done) : removeTodo(state, body.id);
    const summary = body.action === "add" ? `やることを足した：${body.text.trim()}` : body.action === "done" ? `やることを${body.done ? "済みに" : "未済に戻"}した：${body.id}` : `やることを消した：${body.id}`;
    return ok(await store.save(appendAudit(next, { at: now, actor: "staff", kind: "todo", summary, refs: body.action === "add" ? [] : [body.id] })));
  } catch (error) {
    if (error instanceof TodoInputError) return fail(error.message, 400);
    return handleError(error);
  }
}
