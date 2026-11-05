import { z } from "zod";
import { store } from "../../../../../server/store";
import { fail, handleError, ok } from "../../../../../server/http";

const BodySchema = z.object({
  speaker: z.enum(["staff", "chief_mourner", "family"]),
  speakerLabel: z.string().min(1).max(30),
  text: z.string().trim().min(1).max(1000),
  at: z.number().int().min(0),
});

export async function POST(req: Request, ctx: RouteContext<"/api/cases/[caseId]/utterances">): Promise<Response> {
  try {
    const { caseId } = await ctx.params;
    const state = await store.get(caseId);
    if (!state) return fail("案件が見つかりません", 404);
    const body = BodySchema.parse(await req.json());
    const utterance = { ...body, id: `U${state.utterances.length + 1}` };
    return ok(await store.save({ ...state, utterances: [...state.utterances, utterance] }), 201);
  } catch (error) {
    return handleError(error);
  }
}
