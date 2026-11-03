import { toFamilyView } from "../../../../engine/familyView";
import { store } from "../../../../server/store";
import { fail, ok } from "../../../../server/http";

/** 遺族の窓口の表示内容。候補・会話・推奨は含めない */
export async function GET(_req: Request, ctx: RouteContext<"/api/family/[token]">): Promise<Response> {
  const { token } = await ctx.params;
  const state = store.findByToken(token);
  if (!state) return fail("このリンクは使えません。担当者にお問い合わせください", 404);
  return ok(toFamilyView(state));
}
