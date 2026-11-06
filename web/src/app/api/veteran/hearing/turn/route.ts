import { z } from "zod";
import { getHearingScene } from "../../../../../data/hearingScenes";
import { HearingInputError, HearingTurnsSchema, nextFamilyLines, nextInterviewerQuestion } from "../../../../../engine/hearing";
import { hearingFamilyModel, hearingInterviewerModel } from "../../../../../engine/models";
import { spendAiCall } from "../../../../../server/budget";
import { fail, handleError, ok } from "../../../../../server/http";

const BodySchema = z.object({
  sceneId: z.string().max(10),
  phase: z.enum(["roleplay", "debrief"]),
  turns: HearingTurnsSchema,
});

/** 聞き取りの1往復：ロールプレイなら家族の返事、ふりかえりなら聞き手の次の問い（入口の合言葉が要る） */
export async function POST(req: Request): Promise<Response> {
  try {
    const { sceneId, phase, turns } = BodySchema.parse(await req.json());
    const scene = getHearingScene(sceneId);
    const overBudget = await spendAiCall(req);
    if (overBudget) return overBudget;
    if (phase === "roleplay") return ok(await nextFamilyLines(scene, turns, hearingFamilyModel));
    return ok(await nextInterviewerQuestion(scene, turns, hearingInterviewerModel));
  } catch (error) {
    if (error instanceof HearingInputError) return fail(error.message, 400);
    if (error instanceof Error && error.message.startsWith("未定義の聞き取り")) return fail("場面が見つかりません", 404);
    return handleError(error);
  }
}
