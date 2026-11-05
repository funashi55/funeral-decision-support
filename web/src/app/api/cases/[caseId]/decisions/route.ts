import { z } from "zod";
import { appendAudit } from "../../../../../engine/audit";
import { confirmDecision } from "../../../../../engine/extract";
import { store } from "../../../../../server/store";
import { fail, handleError, ok } from "../../../../../server/http";

const BodySchema = z.object({ decisionId: z.string().min(1), value: z.string().trim().min(1).max(200) });

/** 担当者による確定。AI からは呼ばない */
export async function POST(req: Request, ctx: RouteContext<"/api/cases/[caseId]/decisions">): Promise<Response> {
  try {
    const { caseId } = await ctx.params;
    const state = await store.get(caseId);
    if (!state) return fail("案件が見つかりません", 404);
    const { decisionId, value } = BodySchema.parse(await req.json());
    const next = confirmDecision(state, decisionId, value);
    return ok(await store.save(appendAudit(next, { at: Date.now(), actor: "staff", kind: "confirm", summary: `確定：${value}`, refs: [decisionId] })));
  } catch (error) {
    return handleError(error);
  }
}
