import { generateQuickFit } from "../../../../../engine/models";
import { QUICK_FIT_SYSTEM, quickFitPrompt, settleFits, type QuickFit } from "../../../../../engine/quickFit";
import { spendAiCall } from "../../../../../server/budget";
import { fail, handleError, ok } from "../../../../../server/http";
import { store } from "../../../../../server/store";

/** いまの見立て。発言が入るたびに画面から呼ぶ（約2秒）。理由づけは /farewell が書く */
export async function POST(req: Request, ctx: RouteContext<"/api/cases/[caseId]/quick-fit">): Promise<Response> {
  try {
    const { caseId } = await ctx.params;
    const state = await store.get(caseId);
    if (!state) return fail("案件が見つかりません", 404);
    if (state.utterances.length === 0) return fail("まだ会話がありません", 409);
    const overBudget = await spendAiCall(req);
    if (overBudget) return overBudget;
    const t0 = Date.now();
    const draft = await generateQuickFit(QUICK_FIT_SYSTEM, quickFitPrompt(state));
    return ok({ fits: settleFits(draft.fits), basedOn: state.utterances.length, ms: Date.now() - t0 } satisfies QuickFit);
  } catch (error) {
    return handleError(error);
  }
}
