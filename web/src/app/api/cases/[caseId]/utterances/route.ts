import { z } from "zod";
import { classifySpeaker } from "../../../../../engine/models";
import { detectSpeaker, speakerLabelOf } from "../../../../../engine/speaker";
import { spendAiCall } from "../../../../../server/budget";
import { store } from "../../../../../server/store";
import { fail, handleError, ok } from "../../../../../server/http";

const BodySchema = z.object({
  /** auto：話した人を言葉づかいと流れから自動で聞き分ける */
  speaker: z.enum(["staff", "chief_mourner", "family", "auto"]),
  speakerLabel: z.string().min(1).max(30).optional(),
  text: z.string().trim().min(1).max(1000),
  at: z.number().int().min(0),
});

export async function POST(req: Request, ctx: RouteContext<"/api/cases/[caseId]/utterances">): Promise<Response> {
  try {
    const { caseId } = await ctx.params;
    const state = await store.get(caseId);
    if (!state) return fail("案件が見つかりません", 404);
    const body = BodySchema.parse(await req.json());
    const id = `U${state.utterances.length + 1}`;
    if (body.speaker === "auto") {
      // Claude に尋ねるのは決まりごとで決まらないときだけ。上限に達していたら尋ねずに、交互に話す前提で決める
      const classify = process.env.ANTHROPIC_API_KEY ? async (system: string, prompt: string) => {
        if (await spendAiCall(req)) throw new Error("上限");
        return classifySpeaker(system, prompt);
      } : null;
      const guess = await detectSpeaker(body.text, state.utterances, classify);
      const utterance = { id, speaker: guess.speaker, speakerLabel: speakerLabelOf(guess.speaker), text: body.text, at: body.at, speakerBy: guess.by };
      return ok(await store.save({ ...state, utterances: [...state.utterances, utterance] }), 201);
    }
    const utterance = { id, speaker: body.speaker, speakerLabel: body.speakerLabel ?? speakerLabelOf(body.speaker), text: body.text, at: body.at };
    return ok(await store.save({ ...state, utterances: [...state.utterances, utterance] }), 201);
  } catch (error) {
    return handleError(error);
  }
}
