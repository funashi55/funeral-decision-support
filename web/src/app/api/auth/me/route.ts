import type { NextRequest } from "next/server";
import { ok } from "../../../../server/http";
import { SESSION_COOKIE, googleAuthConfig, verifySession } from "../../../../server/session";

/** いまログインしている担当者（ログインの設定がないとき・ログインしていないときは null） */
export async function GET(request: NextRequest): Promise<Response> {
  const config = googleAuthConfig();
  const session = config ? await verifySession(request.cookies.get(SESSION_COOKIE)?.value, config.secret) : null;
  return ok(session ? { email: session.email, name: session.name } : null);
}
