import { z } from "zod";
import { store } from "../../../../../../server/store";
import { fail, handleError, ok } from "../../../../../../server/http";

const BodySchema = z.object({ text: z.string().trim().min(1).max(1000) });

/** 字幕の修正（聞き取りの誤り、寺名・宗派の取り違えなど）。担当者だけが直せる */
export async function PATCH(req: Request, ctx: RouteContext<"/api/cases/[caseId]/utterances/[utteranceId]">): Promise<Response> {
  try {
    const { caseId, utteranceId } = await ctx.params;
    const state = await store.get(caseId);
    if (!state) return fail("案件が見つかりません", 404);
    if (!state.utterances.some((u) => u.id === utteranceId)) return fail("発言が見つかりません", 404);
    const { text } = BodySchema.parse(await req.json());
    return ok(await store.save({ ...state, utterances: state.utterances.map((u) => (u.id === utteranceId ? { ...u, text } : u)) }));
  } catch (error) {
    return handleError(error);
  }
}
