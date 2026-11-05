import { store } from "../../../../server/store";
import { fail, ok } from "../../../../server/http";

export async function GET(_req: Request, ctx: RouteContext<"/api/cases/[caseId]">): Promise<Response> {
  const { caseId } = await ctx.params;
  const state = await store.get(caseId);
  return state ? ok(state) : fail("案件が見つかりません", 404);
}
