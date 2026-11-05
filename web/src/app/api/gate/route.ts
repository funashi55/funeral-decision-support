import { timingSafeEqual } from "node:crypto";
import { ACCESS_COOKIE, ACCESS_MAX_AGE_SECONDS, accessDigest, safeNext } from "../../../server/access";
import { gateLimiter } from "../../../server/gate";
import { clientKey } from "../../../server/rateLimit";

function sameText(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** 入口の合言葉を確かめ、合っていれば cookie を置いて元の場所へ戻す */
export async function POST(req: Request): Promise<Response> {
  const form = await req.formData();
  const next = safeNext(String(form.get("next") ?? "/"));
  const code = process.env.ACCESS_CODE;
  const key = clientKey(req);
  const back = (failed: boolean): URL => {
    const url = new URL(failed ? "/gate" : next, req.url);
    if (failed) {
      url.searchParams.set("next", next);
      url.searchParams.set("error", "1");
    }
    return url;
  };
  if (!code) return Response.redirect(back(false), 303);
  if (gateLimiter.isBlocked(key)) return Response.redirect(back(true), 303);
  if (!sameText(String(form.get("code") ?? ""), code)) {
    gateLimiter.recordFailure(key);
    return Response.redirect(back(true), 303);
  }
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  return new Response(null, {
    status: 303,
    headers: {
      Location: back(false).toString(),
      "Set-Cookie": `${ACCESS_COOKIE}=${await accessDigest(code)}; Path=/; Max-Age=${ACCESS_MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax${secure}`,
    },
  });
}
