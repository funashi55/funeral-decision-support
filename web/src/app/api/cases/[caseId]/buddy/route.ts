import { z } from "zod";
import { BuddySettingsSchema, PhraseSchema, addPhrase, removePhrase, withSettings } from "../../../../../domain/buddy";
import { GRIEF_PRINCIPLES } from "../../../../../domain/griefCare";
import { loadBuddy, updateBuddy } from "../../../../../server/buddy";
import { fail, handleError, ok } from "../../../../../server/http";
import { store } from "../../../../../server/store";

const PhraseBody = z.object({ action: z.enum(["add", "remove"]), principleId: z.string().min(1).max(60), text: PhraseSchema });

async function caseOf(ctx: RouteContext<"/api/cases/[caseId]/buddy">) {
  const { caseId } = await ctx.params;
  return store.get(caseId);
}

/** この案件の担当者のバディ */
export async function GET(_req: Request, ctx: RouteContext<"/api/cases/[caseId]/buddy">): Promise<Response> {
  try {
    const state = await caseOf(ctx);
    if (!state) return fail("案件が見つかりません", 404);
    return ok(await loadBuddy(state));
  } catch (error) {
    return handleError(error);
  }
}

/** 言葉の調子・支援の量を変える */
export async function PATCH(req: Request, ctx: RouteContext<"/api/cases/[caseId]/buddy">): Promise<Response> {
  try {
    const state = await caseOf(ctx);
    if (!state) return fail("案件が見つかりません", 404);
    const parsed = BuddySettingsSchema.safeParse(await req.json());
    if (!parsed.success) return fail("設定を確かめてください", 400);
    return ok(await updateBuddy(state, (p) => withSettings(p, parsed.data)));
  } catch (error) {
    return handleError(error);
  }
}

/** 自分の言い方を残す・消す */
export async function POST(req: Request, ctx: RouteContext<"/api/cases/[caseId]/buddy">): Promise<Response> {
  try {
    const state = await caseOf(ctx);
    if (!state) return fail("案件が見つかりません", 404);
    const parsed = PhraseBody.safeParse(await req.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "言い方を確かめてください", 400);
    const { action, principleId, text } = parsed.data;
    if (!GRIEF_PRINCIPLES.some((x) => x.id === principleId)) return fail("寄り添いの考え方が見つかりません", 400);
    return ok(await updateBuddy(state, (p) => (action === "add" ? addPhrase(p, principleId, text) : removePhrase(p, principleId, text))));
  } catch (error) {
    return handleError(error);
  }
}
