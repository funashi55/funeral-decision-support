import { recommendPlanFit } from "../../../../../engine/planFit";
import { generatePlanFit, judgePlanFit } from "../../../../../engine/models";
import { store } from "../../../../../server/store";
import { spendAiCall } from "../../../../../server/budget";
import { fail, handleError, ok } from "../../../../../server/http";

/** プランの提案：幅ごとの合う・合わないと、ご家族の言葉に結びつけた切り出し方 */
export async function POST(req: Request, ctx: RouteContext<"/api/cases/[caseId]/plan-fit">): Promise<Response> {
  try {
    const { caseId } = await ctx.params;
    const state = await store.get(caseId);
    if (!state) return fail("案件が見つかりません", 404);
    if (state.utterances.length === 0) return fail("まだ会話がありません", 409);
    const overBudget = await spendAiCall(req);
    if (overBudget) return overBudget;
    const result = await recommendPlanFit(state, generatePlanFit, judgePlanFit);
    return ok({ ...result, basedOn: state.utterances.length });
  } catch (error) {
    return handleError(error);
  }
}
