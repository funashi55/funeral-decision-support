import type { CaseState } from "../engine/case";
import { store } from "./store";

/** 保存場所を見に行く間隔。サーバーが何台あっても、同じ保存場所を見ていれば更新に気づける */
const POLL_MS = 1200;
/** 1本の接続を開けておく長さ。切れたらブラウザの EventSource がつなぎ直す */
const STREAM_MS = 240_000;

/** 案件の更新を Server-Sent Events で流す。project で相手に渡す形を決める（遺族には絞った形を渡す） */
export function caseEvents<T>(req: Request, initial: CaseState, project: (state: CaseState) => T, shouldEnd?: (state: CaseState) => boolean): Response {
  const encoder = new TextEncoder();
  const caseId = initial.caseId;
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const close = (): void => {
        if (closed) return;
        closed = true;
        if (timer) clearTimeout(timer);
        try {
          controller.close();
        } catch {
          // 既に閉じている
        }
      };
      const send = (state: CaseState): boolean => {
        if (shouldEnd?.(state)) {
          close();
          return false;
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(project(state))}\n\n`));
        return true;
      };
      req.signal.addEventListener("abort", close);
      const startedAt = Date.now();
      let lastRev = await store.revision(caseId);
      if (!send(initial)) return;
      const tick = async (): Promise<void> => {
        if (closed) return;
        if (Date.now() - startedAt > STREAM_MS) return close();
        try {
          const rev = await store.revision(caseId);
          if (rev !== lastRev) {
            lastRev = rev;
            const state = await store.get(caseId);
            if (state && !send(state)) return;
          }
        } catch (error) {
          process.stderr.write(`[sse] ${error instanceof Error ? error.message : String(error)}\n`);
        }
        if (!closed) timer = setTimeout(() => void tick(), POLL_MS);
      };
      timer = setTimeout(() => void tick(), POLL_MS);
    },
    cancel() {
      closed = true;
      if (timer) clearTimeout(timer);
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
