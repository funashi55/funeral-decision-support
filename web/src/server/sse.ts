import type { CaseState } from "../engine/case";
import { store } from "./store";

/** 案件の更新を Server-Sent Events で流す。project で相手に渡す形を決める（遺族には絞った形を渡す） */
export function caseEvents<T>(req: Request, initial: CaseState, project: (state: CaseState) => T): Response {
  const encoder = new TextEncoder();
  let unsubscribe = (): void => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (state: CaseState): void => controller.enqueue(encoder.encode(`data: ${JSON.stringify(project(state))}\n\n`));
      send(initial);
      unsubscribe = store.subscribe(initial.caseId, send);
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
