import { z } from "zod";
import { toFamilyView } from "../../../../../engine/familyView";
import { addFamilyRequest, REQUEST_TEXT_MAX } from "../../../../../engine/requests";
import { store } from "../../../../../server/store";
import { fail, handleError, ok } from "../../../../../server/http";

const BodySchema = z.object({
  kind: z.enum(["change", "question"]),
  decisionId: z.string().min(1).max(60).nullable(),
  text: z.string().max(REQUEST_TEXT_MAX * 2),
});

/** 遺族から担当者へ、変更の希望や質問を送る。決定そのものは変えない */
export async function POST(req: Request, ctx: RouteContext<"/api/family/[token]/requests">): Promise<Response> {
  try {
    const { token } = await ctx.params;
    const state = store.findByToken(token);
    if (!state) return fail("このリンクは使えません。担当者にお問い合わせください", 404);
    const body = BodySchema.parse(await req.json());
    const next = store.save(addFamilyRequest(state, { ...body, sentAt: Date.now() }));
    return ok(toFamilyView(next), 201);
  } catch (error) {
    return handleError(error);
  }
}
