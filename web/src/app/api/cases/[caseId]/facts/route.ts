import { z } from "zod";
import { appendAudit } from "../../../../../engine/audit";
import { FACT_KEYS, FACT_LABEL, confirmFact } from "../../../../../engine/facts";
import { fail, handleError, ok } from "../../../../../server/http";
import { store } from "../../../../../server/store";

const BodySchema = z.object({ key: z.enum(FACT_KEYS), value: z.string().trim().min(1).max(120) });

/** 受付の事実（故人のお名前など）を担当者が確定・書き直す。AI からは呼ばない */
export async function POST(req: Request, ctx: RouteContext<"/api/cases/[caseId]/facts">): Promise<Response> {
  try {
    const { caseId } = await ctx.params;
    const state = await store.get(caseId);
    if (!state) return fail("案件が見つかりません", 404);
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return fail("入力を確かめてください", 400);
    const { key, value } = parsed.data;
    const at = Date.now();
    let next;
    try {
      next = confirmFact(state, key, value, at);
    } catch (error) {
      if (error instanceof z.ZodError) return fail(error.issues[0]?.message ?? `${FACT_LABEL[key]}の形を確かめてください`, 400);
      throw error;
    }
    return ok(await store.save(appendAudit(next, { at, actor: "staff", kind: "confirm", summary: `${FACT_LABEL[key]}を確定：${value}`, refs: [key] })));
  } catch (error) {
    return handleError(error);
  }
}
