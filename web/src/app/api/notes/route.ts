import { handleError, ok } from "../../../server/http";
import { saveNote } from "../../../server/trialFeedback";

/** 画面のどこからでも送れる感想を保存する */
export async function POST(req: Request): Promise<Response> {
  try {
    const note = await saveNote(await req.json());
    return ok({ at: note.at }, 201);
  } catch (error) {
    return handleError(error);
  }
}
