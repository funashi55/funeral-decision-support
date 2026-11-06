import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "../../../../server/session";

/** ログアウト（セッションの cookie を消して、ログインの画面へ） */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const res = NextResponse.redirect(new URL("/login", request.url), 303);
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
