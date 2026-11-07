import { z } from "zod";
import { speakerLabelOf } from "../../../../../../engine/speaker";
import { store } from "../../../../../../server/store";
import { fail, handleError, ok } from "../../../../../../server/http";

const BodySchema = z
  .object({ text: z.string().trim().min(1).max(1000).optional(), speaker: z.enum(["staff", "family"]).optional() })
  .refine((b) => b.text !== undefined || b.speaker !== undefined, "直す内容がありません");

/** 字幕の修正（聞き取りの誤り、寺名・宗派の取り違えなど）と、話した人の入れ替え（自動の聞き分けの誤り）。担当者だけが直せる */
export async function PATCH(req: Request, ctx: RouteContext<"/api/cases/[caseId]/utterances/[utteranceId]">): Promise<Response> {
  try {
    const { caseId, utteranceId } = await ctx.params;
    const state = await store.get(caseId);
    if (!state) return fail("案件が見つかりません", 404);
    if (!state.utterances.some((u) => u.id === utteranceId)) return fail("発言が見つかりません", 404);
    const { text, speaker } = BodySchema.parse(await req.json());
    const fix = (u: (typeof state.utterances)[number]) => ({
      ...u,
      ...(text !== undefined ? { text } : {}),
      ...(speaker !== undefined ? { speaker, speakerLabel: speakerLabelOf(speaker), speakerBy: "manual" as const } : {}),
    });
    return ok(await store.save({ ...state, utterances: state.utterances.map((u) => (u.id === utteranceId ? fix(u) : u)) }));
  } catch (error) {
    return handleError(error);
  }
}
