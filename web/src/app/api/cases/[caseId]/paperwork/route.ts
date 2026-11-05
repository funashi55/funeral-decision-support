import { generatePaperwork } from "../../../../../engine/models";
import { draftPaperwork } from "../../../../../engine/paperwork";
import { spendAiCall } from "../../../../../server/budget";
import { fail, handleError, ok } from "../../../../../server/http";
import { paperworkStore } from "../../../../../server/paperworkStore";
import { store } from "../../../../../server/store";

/** 保存してある、打合せの後の実務 */
export async function GET(_req: Request, ctx: RouteContext<"/api/cases/[caseId]/paperwork">): Promise<Response> {
  try {
    const { caseId } = await ctx.params;
    return ok((await paperworkStore.get(caseId)) ?? null);
  } catch (error) {
    return handleError(error);
  }
}

/** Claude が打合せのまとめ・TODO・発注書の下書きを作る */
export async function POST(req: Request, ctx: RouteContext<"/api/cases/[caseId]/paperwork">): Promise<Response> {
  try {
    const { caseId } = await ctx.params;
    const state = await store.get(caseId);
    if (!state) return fail("案件が見つかりません", 404);
    if (state.utterances.length === 0) return fail("まだ会話がありません", 409);
    const overBudget = await spendAiCall(req);
    if (overBudget) return overBudget;
    const result = await draftPaperwork(state, generatePaperwork);
    if (!result.ok) return fail("守る線の点検を通る下書きを作れませんでした。もう一度お試しください", 422);
    return ok(await paperworkStore.save(result.paperwork));
  } catch (error) {
    return handleError(error);
  }
}
