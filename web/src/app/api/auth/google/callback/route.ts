import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "../../../../../server/access";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, checkIdToken, googleAuthConfig, readIdToken, signSession } from "../../../../../server/session";

const back = (request: NextRequest, error: string): NextResponse => NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, request.url));

/** Google から戻ってきたところ。コードをトークンに換え、許可されたアカウントならセッションを作る */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const config = googleAuthConfig();
  if (!config) return back(request, "setup");
  const params = request.nextUrl.searchParams;
  const state = request.cookies.get("fds_oauth_state")?.value;
  const verifier = request.cookies.get("fds_oauth_verifier")?.value;
  const code = params.get("code");
  if (params.get("error")) return back(request, "cancelled");
  if (!code || !state || !verifier || params.get("state") !== state) return back(request, "state");

  let idToken: string | undefined;
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: new URL("/api/auth/google/callback", request.url).toString(),
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
    });
    if (!res.ok) return back(request, "token");
    idToken = ((await res.json()) as { id_token?: string }).id_token;
  } catch {
    return back(request, "token");
  }
  const checked = checkIdToken(idToken ? readIdToken(idToken) : null, config);
  if (!checked.ok) return back(request, checked.reason === "このアカウントでは入れません" ? "denied" : "token");

  const token = await signSession({ email: checked.email, name: checked.name, exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000 }, config.secret);
  const res = NextResponse.redirect(new URL(safeNext(request.cookies.get("fds_oauth_next")?.value), request.url));
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: request.nextUrl.protocol === "https:", path: "/", maxAge: SESSION_MAX_AGE_SECONDS });
  for (const name of ["fds_oauth_state", "fds_oauth_verifier", "fds_oauth_next"]) res.cookies.set(name, "", { path: "/api/auth", maxAge: 0 });
  return res;
}
