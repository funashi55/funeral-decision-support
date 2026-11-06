import { store } from "../../../../../server/store";
import { fail, ok } from "../../../../../server/http";
import { orderSheetStore } from "../../../../../server/orderSheetStore";

export async function POST(_req: Request, ctx: RouteContext<"/api/cases/[caseId]/reset">): Promise<Response> {
  const { caseId } = await ctx.params;
  const state = await store.reset(caseId);
  // 最初からやり直すときは、1枚ずつ作った発注書も消す（前の会話の発注書が残らないように）
  if (state) await orderSheetStore.clear(caseId);
  return state ? ok(state) : fail("案件が見つかりません", 404);
}
