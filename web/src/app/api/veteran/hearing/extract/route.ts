import { z } from "zod";
import { getHearingScene } from "../../../../../data/hearingScenes";
import { HearingInputError, HearingTurnsSchema, extractJudgments } from "../../../../../engine/hearing";
import { hearingExtractModel } from "../../../../../engine/models";
import { spendAiCall } from "../../../../../server/budget";
import { fail, handleError, ok } from "../../../../../server/http";

const BodySchema = z.object({ sceneId: z.string().max(10), turns: HearingTurnsSchema });

/** 聞き取りの記録から、ベテランの判断を元の発言つきで取り出す。元の発言に戻れないものは捨てる */
export async function POST(req: Request): Promise<Response> {
  try {
    const { sceneId, turns } = BodySchema.parse(await req.json());
    const scene = getHearingScene(sceneId);
    const overBudget = await spendAiCall(req);
    if (overBudget) return overBudget;
    const { extraction, dropped } = await extractJudgments(scene, turns, hearingExtractModel);
    return ok({ ...extraction, dropped });
  } catch (error) {
    if (error instanceof HearingInputError) return fail(error.message, 400);
    if (error instanceof Error && error.message.startsWith("未定義の聞き取り")) return fail("場面が見つかりません", 404);
    return handleError(error);
  }
}
