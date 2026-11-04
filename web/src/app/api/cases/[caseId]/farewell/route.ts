import { appendAudits, auditOfFarewell } from "../../../../../engine/audit";
import { recommendFarewell } from "../../../../../engine/farewell";
import { generateFarewellDraft, judgeRecommendation } from "../../../../../engine/models";
import { store } from "../../../../../server/store";
import { fail, handleError, ok } from "../../../../../server/http";

export async function POST(_req: Request, ctx: RouteContext<"/api/cases/[caseId]/farewell">): Promise<Response> {
  try {
    const { caseId } = await ctx.params;
    const state = store.get(caseId);
    if (!state) return fail("案件が見つかりません", 404);
    if (state.utterances.length === 0) return fail("まだ会話がありません", 409);
    const result = await recommendFarewell(state, generateFarewellDraft, judgeRecommendation);
    const latest = store.get(caseId) ?? state;
    store.save(appendAudits(latest, auditOfFarewell(result, Date.now())));
    return ok(result);
  } catch (error) {
    return handleError(error);
  }
}
