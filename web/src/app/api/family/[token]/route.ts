import { toFamilyView } from "../../../../engine/familyView";
import { resolveFamily } from "../../../../server/family";
import { ok } from "../../../../server/http";

/** 遺族の窓口の表示内容。候補・会話・推奨は含めない */
export async function GET(req: Request, ctx: RouteContext<"/api/family/[token]">): Promise<Response> {
  const { token } = await ctx.params;
  const state = await resolveFamily(req, token);
  return state instanceof Response ? state : ok(toFamilyView(state));
}
