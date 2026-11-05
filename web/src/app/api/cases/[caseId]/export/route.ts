import { appendAudit } from "../../../../../engine/audit";
import { toCoreCsv } from "../../../../../engine/orders";
import { store } from "../../../../../server/store";
import { fail } from "../../../../../server/http";

/** 基幹システム向けの CSV。確定した決定だけを、施行情報の項目名で書き出す */
export async function GET(_req: Request, ctx: RouteContext<"/api/cases/[caseId]/export">): Promise<Response> {
  const { caseId } = await ctx.params;
  const state = await store.get(caseId);
  if (!state) return fail("案件が見つかりません", 404);
  await store.save(appendAudit(state, { at: Date.now(), actor: "staff", kind: "export", summary: "基幹システム向けの CSV を書き出した", refs: [] }));
  return new Response(toCoreCsv(state), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(caseId)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
