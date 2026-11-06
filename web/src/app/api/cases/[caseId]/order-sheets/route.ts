import { z } from "zod";
import { appendAudit } from "../../../../../engine/audit";
import { OrderSheetError, buildOrderSheet } from "../../../../../engine/orderSheet";
import { fail, handleError, ok } from "../../../../../server/http";
import { orderSheetStore } from "../../../../../server/orderSheetStore";
import { store } from "../../../../../server/store";

const BodySchema = z.object({ orderId: z.string().regex(/^[a-z_]{1,40}$/) });

/** 作ってある発注書（発注の種類ごと） */
export async function GET(_req: Request, ctx: RouteContext<"/api/cases/[caseId]/order-sheets">): Promise<Response> {
  try {
    const { caseId } = await ctx.params;
    return ok(await orderSheetStore.all(caseId));
  } catch (error) {
    return handleError(error);
  }
}

/** 発注書を1枚作る（AI は使わず、確定した決定の値だけで書く） */
export async function POST(req: Request, ctx: RouteContext<"/api/cases/[caseId]/order-sheets">): Promise<Response> {
  try {
    const { caseId } = await ctx.params;
    const state = await store.get(caseId);
    if (!state) return fail("案件が見つかりません", 404);
    const { orderId } = BodySchema.parse(await req.json());
    const now = Date.now();
    const sheet = buildOrderSheet(state, orderId, now);
    const saved = await orderSheetStore.save(caseId, sheet);
    await store.save(appendAudit(state, { at: now, actor: "staff", kind: "todo", summary: `発注書を作った：${sheet.sheet.label}`, refs: [orderId] }));
    return ok(saved);
  } catch (error) {
    if (error instanceof OrderSheetError) return fail(error.message, 400);
    return handleError(error);
  }
}
