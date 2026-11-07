import { handleError } from "../../../server/http";
import { store } from "../../../server/store";

/** 試してもらう人ごとに新しい案件を作り、担当者の画面へ送る（同じ案件を何人もで触って混ざらないように） */
export async function POST(req: Request): Promise<Response> {
  try {
    const created = await store.createTrial();
    return Response.redirect(new URL(`/demo/${created.caseId}`, req.url), 303);
  } catch (error) {
    return handleError(error);
  }
}
