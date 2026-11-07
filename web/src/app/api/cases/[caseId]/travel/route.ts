import { caseMode } from "../../../../../domain/caseMode";
import { factValue } from "../../../../../engine/facts";
import { loadDirectory } from "../../../../../server/directory";
import { fail, handleError, ok } from "../../../../../server/http";
import { store } from "../../../../../server/store";
import { travelView } from "../../../../../server/travel";

/** 会館のピンと、確定したご自宅の住所から各会館までの車の時間（住所は URL に載せず、案件から読む） */
export async function GET(_req: Request, ctx: RouteContext<"/api/cases/[caseId]/travel">): Promise<Response> {
  try {
    const { caseId } = await ctx.params;
    const mode = caseMode(caseId);
    if (!mode) return fail("案件が見つかりません", 404);
    const state = await store.get(caseId);
    if (!state) return fail("案件が見つかりません", 404);
    return ok(await travelView(await loadDirectory(mode), factValue(state.registration, "homeAddress")));
  } catch (error) {
    return handleError(error);
  }
}
