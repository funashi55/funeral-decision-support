import { z } from "zod";
import { appendAudit } from "../../../../../engine/audit";
import { markDoneByFamily } from "../../../../../engine/familyTasks";
import { toFamilyView } from "../../../../../engine/familyView";
import { resolveFamily } from "../../../../../server/family";
import { fail, handleError, ok } from "../../../../../server/http";
import { store } from "../../../../../server/store";

const BodySchema = z.object({ id: z.string().min(1).max(40), done: z.boolean() });

/** ご家族が、お願い（調べること・用意すること）に済んだ印を付ける・外す */
export async function POST(req: Request, ctx: RouteContext<"/api/family/[token]/tasks">): Promise<Response> {
  try {
    const { token } = await ctx.params;
    const state = await resolveFamily(req, token);
    if (state instanceof Response) return state;
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return fail("入力を確かめてください", 400);
    let next;
    try {
      next = markDoneByFamily(state, parsed.data.id, parsed.data.done);
    } catch {
      return fail("見つかりません", 404);
    }
    const saved = await store.save(appendAudit(next, { at: Date.now(), actor: "family", kind: "family_task", summary: parsed.data.done ? "ご家族がお願いを済ませた" : "ご家族がお願いの済みを外した", refs: [parsed.data.id] }));
    return ok(toFamilyView(saved));
  } catch (error) {
    return handleError(error);
  }
}
