import { handleError, ok } from "../../../../server/http";
import { listNotes, listVeteranSubmissions, saveVeteranSubmission } from "../../../../server/trialFeedback";

/** ベテランが場面に答えたものを保存する（入口の合言葉が要る） */
export async function POST(req: Request): Promise<Response> {
  try {
    const saved = await saveVeteranSubmission(await req.json());
    return ok({ at: saved.at, answered: Object.keys(saved.scenes).length }, 201);
  } catch (error) {
    return handleError(error);
  }
}

/** 集まった答えと感想をまとめて返す（取り出し用） */
export async function GET(): Promise<Response> {
  try {
    return ok({ submissions: await listVeteranSubmissions(), notes: await listNotes() });
  } catch (error) {
    return handleError(error);
  }
}
