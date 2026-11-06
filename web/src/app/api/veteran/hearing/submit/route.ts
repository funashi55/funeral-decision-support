import { handleError, ok } from "../../../../../server/http";
import { saveHearing } from "../../../../../server/trialFeedback";

/** 聞き取りの1場面分を保存する（入口の合言葉が要る） */
export async function POST(req: Request): Promise<Response> {
  try {
    const saved = await saveHearing(await req.json());
    return ok({ at: saved.at, judgments: saved.judgments.length }, 201);
  } catch (error) {
    return handleError(error);
  }
}
