import { appendAudit } from "../../../../../engine/audit";
import { TaskActionSchema, applyTaskAction } from "../../../../../engine/familyTasks";
import { fail, handleError, ok } from "../../../../../server/http";
import { store } from "../../../../../server/store";

const SUMMARY = { add: "ご家族へのお願いを足した", edit: "ご家族へのお願いを直した", share: "ご家族へのお願いの見せ方を変えた", done: "ご家族へのお願いの済みを変えた", remove: "ご家族へのお願いを消した" } as const;

/** ご家族へのお願いを、担当者が足す・直す・見せる・済みにする・消す */
export async function POST(req: Request, ctx: RouteContext<"/api/cases/[caseId]/family-tasks">): Promise<Response> {
  try {
    const { caseId } = await ctx.params;
    const state = await store.get(caseId);
    if (!state) return fail("案件が見つかりません", 404);
    const parsed = TaskActionSchema.safeParse(await req.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "入力を確かめてください", 400);
    const at = Date.now();
    let next;
    try {
      next = applyTaskAction(state, parsed.data, at);
    } catch {
      return fail("お願いが見つかりません", 404);
    }
    const ref = "id" in parsed.data ? parsed.data.id : "new";
    return ok(await store.save(appendAudit(next, { at, actor: "staff", kind: "family_task", summary: SUMMARY[parsed.data.action], refs: [ref] })));
  } catch (error) {
    return handleError(error);
  }
}
