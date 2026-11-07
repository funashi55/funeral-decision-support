import { caseMode } from "../domain/caseMode";

/**
 * URL とデモ・本番の振り分け。
 * - /demo/<デモの案件>/…   → 中身は /staff/<id>/… の画面で出す（書き換え）
 * - /staff/<デモの案件>/…  → /demo/<id>/… へ移す
 * - /demo/<本番の案件>/…   → /staff/<id>/… へ移す（本番の案件をデモとして扱わない）
 * - /demo/<知らない ID>/…  → 見つからない
 */
export type ModeRoute =
  | { readonly kind: "rewrite"; readonly path: string }
  | { readonly kind: "redirect"; readonly path: string }
  | { readonly kind: "notFound" };

const CASE_PATH = /^\/(staff|demo)\/([^/]+)(\/.*)?$/;

export function modeRoute(pathname: string): ModeRoute | undefined {
  const m = CASE_PATH.exec(pathname);
  if (!m) return undefined;
  const [, area, rawId, rest = ""] = m;
  const caseId = decodeURIComponent(rawId);
  const mode = caseMode(caseId);
  if (area === "staff") return mode === "demo" ? { kind: "redirect", path: `/demo/${rawId}${rest}` } : undefined;
  if (mode === "demo") return { kind: "rewrite", path: `/staff/${rawId}${rest}` };
  if (mode === "live") return { kind: "redirect", path: `/staff/${rawId}${rest}` };
  return { kind: "notFound" };
}
