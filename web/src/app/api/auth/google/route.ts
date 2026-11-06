import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "../../../../server/access";
import { googleAuthConfig, pkceChallenge, randomToken } from "../../../../server/session";

/** 往復のあいだだけ使う cookie（10分） */
const FLOW_MAX_AGE = 600;

/** Google のログイン画面へ送る（state と PKCE を付ける） */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const config = googleAuthConfig();
  if (!config) return NextResponse.redirect(new URL("/login?error=setup", request.url));
  const state = randomToken();
  const verifier = randomToken(48);
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: new URL("/api/auth/google/callback", request.url).toString(),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: await pkceChallenge(verifier),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  const res = NextResponse.redirect(url);
  const secure = request.nextUrl.protocol === "https:";
  const flow = { httpOnly: true, sameSite: "lax" as const, secure, path: "/api/auth", maxAge: FLOW_MAX_AGE };
  res.cookies.set("fds_oauth_state", state, flow);
  res.cookies.set("fds_oauth_verifier", verifier, flow);
  res.cookies.set("fds_oauth_next", next, flow);
  return res;
}
