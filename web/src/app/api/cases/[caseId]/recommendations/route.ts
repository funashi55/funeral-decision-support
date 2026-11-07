import { handleError, ok } from "../../../../../server/http";
import { recommendationStore } from "../../../../../server/recommendationStore";

/** 最後に出した推奨（画面を開いたときに読み込む） */
export async function GET(_req: Request, ctx: RouteContext<"/api/cases/[caseId]/recommendations">): Promise<Response> {
  try {
    const { caseId } = await ctx.params;
    return ok(await recommendationStore.get(caseId));
  } catch (error) {
    return handleError(error);
  }
}
