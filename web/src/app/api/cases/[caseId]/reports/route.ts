import { randomBytes } from "node:crypto";
import { appendAudit } from "../../../../../engine/audit";
import { cleanTranscript, generateReport } from "../../../../../engine/models";
import { buildReport } from "../../../../../engine/report";
import { spendAiCall } from "../../../../../server/budget";
import { fail, handleError, ok } from "../../../../../server/http";
import { reportStore } from "../../../../../server/reportStore";
import { store } from "../../../../../server/store";

/** この案件の打合せの記録（古い順） */
export async function GET(_req: Request, ctx: RouteContext<"/api/cases/[caseId]/reports">): Promise<Response> {
  try {
    const { caseId } = await ctx.params;
    if (!(await store.get(caseId))) return fail("案件が見つかりません", 404);
    return ok(await reportStore.list(caseId));
  } catch (error) {
    return handleError(error);
  }
}

/** 打合せを終える：前回の記録のあとの会話から、この回の要約と清書を作って残す */
export async function POST(req: Request, ctx: RouteContext<"/api/cases/[caseId]/reports">): Promise<Response> {
  try {
    const { caseId } = await ctx.params;
    const state = await store.get(caseId);
    if (!state) return fail("案件が見つかりません", 404);
    const previous = await reportStore.list(caseId);
    if (state.utterances.length === 0 || previous.at(-1)?.transcript.at(-1)?.id === state.utterances.at(-1)?.id) return fail("前の記録のあとに会話がありません", 409);
    const overBudget = await spendAiCall(req);
    if (overBudget) return overBudget;
    const at = Date.now();
    const report = await buildReport(state, previous, { summarize: generateReport, clean: cleanTranscript }, at, `r-${randomBytes(6).toString("base64url")}`);
    if (!report) return fail("前の記録のあとに会話がありません", 409);
    const all = await reportStore.add(report);
    const latest = (await store.get(caseId)) ?? state;
    await store.save(appendAudit(latest, { at, actor: "staff", kind: "report", summary: `第${report.number}回の打合せの記録を作成`, refs: [report.id] }));
    return ok(all);
  } catch (error) {
    return handleError(error);
  }
}
