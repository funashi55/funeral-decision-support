import { isDemoCase } from "../../../../../domain/caseMode";
import { store } from "../../../../../server/store";
import { fail, ok } from "../../../../../server/http";
import { orderSheetStore } from "../../../../../server/orderSheetStore";
import { recommendationStore } from "../../../../../server/recommendationStore";

export async function POST(_req: Request, ctx: RouteContext<"/api/cases/[caseId]/reset">): Promise<Response> {
  const { caseId } = await ctx.params;
  // 「最初から」はデモだけ。本番の案件の会話と決めたことは消さない
  if (!isDemoCase(caseId)) return fail("本番の案件は最初に戻せません", 403);
  const state = await store.reset(caseId);
  // 最初からやり直すときは、1枚ずつ作った発注書も消す（前の会話の発注書が残らないように）
  if (state) await Promise.all([orderSheetStore.clear(caseId), recommendationStore.clear(caseId)]);
  return state ? ok(state) : fail("案件が見つかりません", 404);
}
