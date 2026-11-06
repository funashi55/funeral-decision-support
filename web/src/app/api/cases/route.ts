import { z } from "zod";
import { RegistrationSchema } from "../../../engine/registration";
import { fail, handleError, ok } from "../../../server/http";
import { store } from "../../../server/store";

/** 登録した喪家の一覧 */
export async function GET(): Promise<Response> {
  try {
    return ok(await store.listCases());
  } catch (error) {
    return handleError(error);
  }
}

/** 喪家を登録して案件を作る。返した caseId の打合せの画面へ進む */
export async function POST(req: Request): Promise<Response> {
  try {
    const parsed = RegistrationSchema.safeParse(await req.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "入力を確かめてください", 400);
    const state = await store.createCase({ ...parsed.data, registeredAt: Date.now() });
    return ok({ caseId: state.caseId });
  } catch (error) {
    if (error instanceof z.ZodError) return fail("入力を確かめてください", 400);
    return handleError(error);
  }
}
