"use client";
import { useEffect, useState } from "react";
import type { FamilyView } from "../engine/familyView";

export type FamilyStreamStatus = "connecting" | "open" | "reconnecting" | "not_found";

/** 遺族の窓口の表示内容を受け取り続ける。リンクが無効なら not_found */
export function useFamilyStream(token: string): { view: FamilyView | null; status: FamilyStreamStatus } {
  const [view, setView] = useState<FamilyView | null>(null);
  const [status, setStatus] = useState<FamilyStreamStatus>("connecting");
  useEffect(() => {
    let closed = false;
    const source = new EventSource(`/api/family/${encodeURIComponent(token)}/events`);
    source.onopen = () => setStatus("open");
    source.onmessage = (e: MessageEvent<string>) => setView(JSON.parse(e.data) as FamilyView);
    source.onerror = async () => {
      // 404 のときは再接続しても無駄なので止める
      const res = await fetch(`/api/family/${encodeURIComponent(token)}`).catch(() => null);
      if (closed) return;
      if (res?.status === 404) {
        source.close();
        setStatus("not_found");
      } else setStatus("reconnecting");
    };
    return () => {
      closed = true;
      source.close();
    };
  }, [token]);
  return { view, status };
}
