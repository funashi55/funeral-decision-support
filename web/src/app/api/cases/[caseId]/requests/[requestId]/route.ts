import { z } from "zod";
import { acknowledgeRequest } from "../../../../../../engine/requests";
import { store } from "../../../../../../server/store";
import { fail, handleError, ok } from "../../../../../../server/http";

const BodySchema = z.object({ reply: z.string().trim().max(300).nullable() });

/** 担当者が遺族からの依頼を受け取り、返事を返す */
export async function POST(req: Request, ctx: RouteContext<"/api/cases/[caseId]/requests/[requestId]">): Promise<Response> {
  try {
    const { caseId, requestId } = await ctx.params;
    const state = store.get(caseId);
    if (!state) return fail("案件が見つかりません", 404);
    const { reply } = BodySchema.parse(await req.json());
    return ok(store.save(acknowledgeRequest(state, requestId, reply)));
  } catch (error) {
    return handleError(error);
  }
}
