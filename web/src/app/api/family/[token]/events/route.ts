import { toFamilyView } from "../../../../../engine/familyView";
import { store } from "../../../../../server/store";
import { fail } from "../../../../../server/http";
import { caseEvents } from "../../../../../server/sse";

/** 遺族の窓口へ、確定したことと依頼の状況だけを流す */
export async function GET(req: Request, ctx: RouteContext<"/api/family/[token]/events">): Promise<Response> {
  const { token } = await ctx.params;
  const initial = store.findByToken(token);
  if (!initial) return fail("このリンクは使えません。担当者にお問い合わせください", 404);
  return caseEvents(req, initial, toFamilyView);
}
