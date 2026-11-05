/**
 * 試用の入口の合言葉。環境変数 ACCESS_CODE があるときだけ効く（手元とテストでは素通し）。
 * ブラウザには合言葉そのものではなく、そのハッシュを cookie に置く。
 */
export const ACCESS_COOKIE = "fds_access";
export const ACCESS_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

/** 合言葉なしで開ける場所：入口そのもの、ご家族の窓口（窓口のリンク自体が推測されにくい合言葉）、静的ファイル */
const OPEN_PREFIXES = ["/gate", "/api/gate", "/f/", "/api/family/", "/_next/", "/favicon", "/altar/", "/robots.txt"];

export function isOpenPath(pathname: string): boolean {
  return OPEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

export async function accessDigest(code: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`fds:${code}`));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** 入口のあとに戻る先。外のサイトへ飛ばされないよう、同じサイトの道筋だけを受け付ける */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
