import { appendAudits, auditOfFarewell } from "../../../../../engine/audit";
import { recommendFarewell } from "../../../../../engine/farewell";
import { generateFarewellDraft, judgeRecommendation } from "../../../../../engine/models";
import { store } from "../../../../../server/store";
import { loadBuddy } from "../../../../../server/buddy";
import { stylePrompt } from "../../../../../domain/buddy";
import { previousMeetingsPrompt } from "../../../../../engine/report";
import { reportStore } from "../../../../../server/reportStore";
import { spendAiCall } from "../../../../../server/budget";
import { fail, handleError, ok } from "../../../../../server/http";
import { recommendationStore } from "../../../../../server/recommendationStore";

export async function POST(req: Request, ctx: RouteContext<"/api/cases/[caseId]/farewell">): Promise<Response> {
  try {
    const { caseId } = await ctx.params;
    const state = await store.get(caseId);
    if (!state) return fail("案件が見つかりません", 404);
    if (state.utterances.length === 0) return fail("まだ会話がありません", 409);
    const overBudget = await spendAiCall(req);
    if (overBudget) return overBudget;
    const result = await recommendFarewell(state, generateFarewellDraft, judgeRecommendation, undefined, stylePrompt(await loadBuddy(state)) + previousMeetingsPrompt(await reportStore.list(caseId)));
    const latest = await store.get(caseId) ?? state;
    await store.save(appendAudits(latest, auditOfFarewell(result, Date.now())));
    const saved = { ...result, basedOn: state.utterances.length };
    // 出せなかった結果で、前に出せた推奨を上書きしない
    const before = await recommendationStore.get(caseId);
    if (result.ok || !before?.farewell?.ok) await recommendationStore.put(caseId, { farewell: saved });
    return ok(saved);
  } catch (error) {
    return handleError(error);
  }
}
