import { z } from "zod";
import { toFamilyView } from "../../../../../engine/familyView";
import { addFamilyRequest, REQUEST_TEXT_MAX } from "../../../../../engine/requests";
import { appendAudit } from "../../../../../engine/audit";
import { resolveFamily } from "../../../../../server/family";
import { store } from "../../../../../server/store";
import { handleError, ok } from "../../../../../server/http";

const BodySchema = z.object({
  kind: z.enum(["change", "question"]),
  decisionId: z.string().min(1).max(60).nullable(),
  text: z.string().max(REQUEST_TEXT_MAX * 2),
});

/** 遺族から担当者へ、変更の希望や質問を送る。決定そのものは変えない */
export async function POST(req: Request, ctx: RouteContext<"/api/family/[token]/requests">): Promise<Response> {
  try {
    const { token } = await ctx.params;
    const state = await resolveFamily(req, token);
    if (state instanceof Response) return state;
    const body = BodySchema.parse(await req.json());
    const added = addFamilyRequest(state, { ...body, sentAt: Date.now() });
    const request = added.requests[added.requests.length - 1];
    const summary = body.kind === "change" ? "遺族から変更の希望が届いた" : "遺族から質問が届いた";
    const next = await store.save(appendAudit(added, { at: Date.now(), actor: "family", kind: "family_request", summary, refs: [request?.id ?? "", ...(body.decisionId ? [body.decisionId] : [])] }));
    return ok(toFamilyView(next), 201);
  } catch (error) {
    return handleError(error);
  }
}
