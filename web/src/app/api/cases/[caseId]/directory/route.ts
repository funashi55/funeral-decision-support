import { caseMode } from "../../../../../domain/caseMode";
import { fail, handleError, ok } from "../../../../../server/http";
import { loadDirectory } from "../../../../../server/directory";

/** その案件で使う関係先の名簿（デモは架空、本番は自社の名簿） */
export async function GET(_req: Request, ctx: RouteContext<"/api/cases/[caseId]/directory">): Promise<Response> {
  try {
    const { caseId } = await ctx.params;
    const mode = caseMode(caseId);
    if (!mode) return fail("案件が見つかりません", 404);
    return ok(await loadDirectory(mode));
  } catch (error) {
    return handleError(error);
  }
}
