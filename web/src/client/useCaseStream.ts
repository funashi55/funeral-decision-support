"use client";
import { useEffect, useState } from "react";
import type { CaseState } from "../engine/case";

/** 案件の更新をサーバーから受け取り続ける。切れたらブラウザが自動で再接続する */
export function useCaseStream(caseId: string): { state: CaseState | null; connected: boolean } {
  const [state, setState] = useState<CaseState | null>(null);
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const source = new EventSource(`/api/cases/${caseId}/events`);
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (e: MessageEvent<string>) => setState(JSON.parse(e.data) as CaseState);
    return () => source.close();
  }, [caseId]);
  return { state, connected };
}
