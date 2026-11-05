import { z } from "zod";
import { CHAT_TEXT_MAX, ChatInputError, UNAVAILABLE_REPLY, runFamilyChat } from "../../../../../engine/familyChat";
import { toFamilyView } from "../../../../../engine/familyView";
import { familyChatModel } from "../../../../../engine/models";
import { resolveFamily } from "../../../../../server/family";
import { fail, handleError, ok } from "../../../../../server/http";
import { store } from "../../../../../server/store";
import { spendAiCall } from "../../../../../server/budget";

const BodySchema = z.object({ text: z.string().max(CHAT_TEXT_MAX * 2) });

/** ご家族が案内役に問いかける。案内役は記録を読む・メモを残す・担当者に回すことしかできない */
export async function POST(req: Request, ctx: RouteContext<"/api/family/[token]/chat">): Promise<Response> {
  try {
    const { token } = await ctx.params;
    const state = await resolveFamily(req, token);
    if (state instanceof Response) return state;
    const { text } = BodySchema.parse(await req.json());
    const overBudget = await spendAiCall(req);
    if (overBudget) return overBudget;
    try {
      const next = await runFamilyChat(state, text, familyChatModel);
      // 案内役が考えている間に担当者が確定・返事をしていても、それを消さないよう、やりとりと道具の結果だけを足す
      const latest = await store.get(state.caseId) ?? state;
      const merged = {
        ...latest,
        familyChat: next.familyChat,
        familyNotes: next.familyNotes,
        requests: [...latest.requests, ...next.requests.slice(state.requests.length)],
        audit: [...latest.audit, ...next.audit.slice(state.audit.length)],
      };
      return ok(toFamilyView(await store.save(merged)));
    } catch (error) {
      if (error instanceof ChatInputError) return fail(error.message, 400);
      process.stderr.write(`[family-chat] ${error instanceof Error ? error.message : String(error)}\n`);
      return fail(UNAVAILABLE_REPLY, 503);
    }
  } catch (error) {
    return handleError(error);
  }
}
