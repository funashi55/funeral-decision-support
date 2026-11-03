import { store } from "../../../../../server/store";
import { fail } from "../../../../../server/http";

/** 案件の更新を Server-Sent Events で流す（遺族の窓口と担当者の画面の連動用） */
export async function GET(req: Request, ctx: RouteContext<"/api/cases/[caseId]/events">): Promise<Response> {
  const { caseId } = await ctx.params;
  const initial = store.get(caseId);
  if (!initial) return fail("案件が見つかりません", 404);
  const encoder = new TextEncoder();
  let unsubscribe = (): void => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (data: unknown): void => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      send(initial);
      unsubscribe = store.subscribe(caseId, send);
      req.signal.addEventListener("abort", () => {
        unsubscribe();
        controller.close();
      });
    },
    cancel() {
      unsubscribe();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
