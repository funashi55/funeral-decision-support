import { z } from "zod";
import { getHearingScene } from "../../../../../data/hearingScenes";
import { HearingInputError, HearingTurnsSchema, nextFamilyLines } from "../../../../../engine/hearing";
import { hearingFamilyModel } from "../../../../../engine/models";
import { spendAiCall } from "../../../../../server/budget";
import { fail, handleError, ok } from "../../../../../server/http";

const BodySchema = z.object({
  sceneId: z.string().max(10),
  turns: HearingTurnsSchema,
});

/** 打合せの1往復：担当者の言葉に、ご遺族役が応える（入口の合言葉が要る） */
export async function POST(req: Request): Promise<Response> {
  try {
    const { sceneId, turns } = BodySchema.parse(await req.json());
    const scene = getHearingScene(sceneId);
    const overBudget = await spendAiCall(req);
    if (overBudget) return overBudget;
    return ok(await nextFamilyLines(scene, turns, hearingFamilyModel));
  } catch (error) {
    if (error instanceof HearingInputError) return fail(error.message, 400);
    if (error instanceof Error && error.message.startsWith("未定義の聞き取り")) return fail("場面が見つかりません", 404);
    return handleError(error);
  }
}
