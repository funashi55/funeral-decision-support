import { toFamilyView } from "../../../../../engine/familyView";
import { resolveFamily } from "../../../../../server/family";
import { caseEvents } from "../../../../../server/sse";

/** 遺族の窓口へ、確定したことと依頼の状況だけを流す。リンクを止めたら流すのをやめる */
export async function GET(req: Request, ctx: RouteContext<"/api/family/[token]/events">): Promise<Response> {
  const { token } = await ctx.params;
  const initial = resolveFamily(req, token);
  if (initial instanceof Response) return initial;
  return caseEvents(req, initial, toFamilyView, (s) => s.familyLinkRevoked || s.familyToken !== token);
}
