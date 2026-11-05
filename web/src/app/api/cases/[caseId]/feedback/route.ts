import { z } from "zod";
import { appendAudit } from "../../../../../engine/audit";
import { store } from "../../../../../server/store";
import { fail, handleError, ok } from "../../../../../server/http";

const BodySchema = z.object({
  target: z.string().regex(/^(farewell|oversight|plan):[a-z_]+$/),
  verdict: z.enum(["told", "unused"]),
});

const VERDICT_LABEL = { told: "家族に伝えた", unused: "使わなかった" } as const;

/** 推奨や知らせを、担当者が家族に伝えたか・使わなかったかを記録する（知見の改善に使う） */
export async function POST(req: Request, ctx: RouteContext<"/api/cases/[caseId]/feedback">): Promise<Response> {
  try {
    const { caseId } = await ctx.params;
    const state = await store.get(caseId);
    if (!state) return fail("案件が見つかりません", 404);
    const { target, verdict } = BodySchema.parse(await req.json());
    const at = Date.now();
    const feedback = [...state.feedback.filter((f) => f.target !== target), { target, verdict, at }];
    const next = appendAudit({ ...state, feedback }, { at, actor: "staff", kind: "feedback", summary: VERDICT_LABEL[verdict], refs: [target] });
    return ok(await store.save(next));
  } catch (error) {
    return handleError(error);
  }
}
