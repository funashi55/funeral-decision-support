import { z } from "zod";
import { appendAudit } from "../../../../../engine/audit";
import { store } from "../../../../../server/store";
import { updateBuddy } from "../../../../../server/buddy";
import { recordUsage, type Verdict } from "../../../../../domain/buddy";
import { fail, handleError, ok } from "../../../../../server/http";

const BodySchema = z.object({
  target: z.string().regex(/^(farewell|oversight|plan|care|question|caution):[a-z0-9_-]{1,60}$/),
  /** clear は記録を消して、提案を元に戻す（押し間違いのため） */
  verdict: z.enum(["told", "unused", "clear"]),
});

const VERDICT_LABEL = { told: "家族に伝えた", unused: "使わなかった", clear: "記録を戻した" } as const;

/** 推奨や知らせを、担当者が家族に伝えたか・使わなかったかを記録する（知見の改善に使う） */
export async function POST(req: Request, ctx: RouteContext<"/api/cases/[caseId]/feedback">): Promise<Response> {
  try {
    const { caseId } = await ctx.params;
    const state = await store.get(caseId);
    if (!state) return fail("案件が見つかりません", 404);
    const { target, verdict } = BodySchema.parse(await req.json());
    const at = Date.now();
    const kept = state.feedback.filter((f) => f.target !== target);
    const before = state.feedback.find((f) => f.target === target)?.verdict as Verdict | undefined;
    // 担当者のバディにも数える（案件をまたいで育つ）
    await updateBuddy(state, (p) => recordUsage(p, target, before, verdict === "clear" ? undefined : verdict));
    const feedback = verdict === "clear" ? kept : [...kept, { target, verdict, at }];
    const next = appendAudit({ ...state, feedback }, { at, actor: "staff", kind: "feedback", summary: VERDICT_LABEL[verdict], refs: [target] });
    return ok(await store.save(next));
  } catch (error) {
    return handleError(error);
  }
}
