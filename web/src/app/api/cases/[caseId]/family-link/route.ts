import { z } from "zod";
import { newFamilyToken } from "../../../../../server/family";
import { store } from "../../../../../server/store";
import { fail, handleError, ok } from "../../../../../server/http";

const BodySchema = z.object({ action: z.enum(["revoke", "reissue"]) });

/** 遺族の窓口のリンクを止める、または新しいリンクを発行する（古いリンクは使えなくなる） */
export async function POST(req: Request, ctx: RouteContext<"/api/cases/[caseId]/family-link">): Promise<Response> {
  try {
    const { caseId } = await ctx.params;
    const state = store.get(caseId);
    if (!state) return fail("案件が見つかりません", 404);
    const { action } = BodySchema.parse(await req.json());
    const next = action === "revoke" ? { ...state, familyLinkRevoked: true } : { ...state, familyLinkRevoked: false, familyToken: newFamilyToken() };
    return ok(store.save(next));
  } catch (error) {
    return handleError(error);
  }
}
