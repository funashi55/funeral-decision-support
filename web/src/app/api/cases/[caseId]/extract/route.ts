import { applyExtraction, extractFromUtterances } from "../../../../../engine/extract";
import { store } from "../../../../../server/store";
import { spendAiCall } from "../../../../../server/budget";
import { fail, handleError, ok } from "../../../../../server/http";

export async function POST(req: Request, ctx: RouteContext<"/api/cases/[caseId]/extract">): Promise<Response> {
  try {
    const { caseId } = await ctx.params;
    const state = await store.get(caseId);
    if (!state) return fail("案件が見つかりません", 404);
    if (state.utterances.length === 0) return ok(state);
    const overBudget = await spendAiCall(req);
    if (overBudget) return overBudget;
    const extraction = await extractFromUtterances(state.utterances);
    // 抽出中に発言が増えていても失わないよう、最新の状態に反映する
    const latest = await store.get(caseId) ?? state;
    return ok(await store.save(applyExtraction(latest, extraction)));
  } catch (error) {
    return handleError(error);
  }
}
