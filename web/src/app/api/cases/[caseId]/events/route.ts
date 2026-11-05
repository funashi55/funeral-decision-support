import { store } from "../../../../../server/store";
import { fail } from "../../../../../server/http";
import { caseEvents } from "../../../../../server/sse";

/** 担当者の画面へ案件の更新を流す */
export async function GET(req: Request, ctx: RouteContext<"/api/cases/[caseId]/events">): Promise<Response> {
  const { caseId } = await ctx.params;
  const initial = await store.get(caseId);
  if (!initial) return fail("案件が見つかりません", 404);
  return caseEvents(req, initial, (state) => state);
}
