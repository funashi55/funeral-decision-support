import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, accessDigest, isOpenPath } from "./server/access";
import { modeRoute } from "./server/modeRoute";
import { SESSION_COOKIE, googleAuthConfig, verifySession } from "./server/session";

/**
 * 入口。Google ログインの設定があれば、ログインした担当者だけが担当者の画面・API を使える。
 * なければ、試用の合言葉（ACCESS_CODE）があるときだけ合言葉で守る。どちらもなければ手元の開発として素通し
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const code = process.env.ACCESS_CODE;
  const { pathname, search } = request.nextUrl;
  const google = googleAuthConfig();
  if (google) {
    if (isOpenPath(pathname)) return pass(request);
    if (await verifySession(request.cookies.get(SESSION_COOKIE)?.value, google.secret)) return pass(request);
    if (pathname.startsWith("/api/")) return NextResponse.json({ success: false, error: "ログインしてから使ってください" }, { status: 401 });
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }
  // Vercel の本番で合言葉を入れ忘れたら、開けたままにせず閉じる（AI の料金がかかるため）
  if (!code && process.env.VERCEL_ENV === "production") {
    return new NextResponse("試用の準備中です。", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  if (!code || isOpenPath(pathname)) return pass(request);
  const cookie = request.cookies.get(ACCESS_COOKIE)?.value;
  if (cookie && cookie === (await accessDigest(code))) return pass(request);
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ success: false, error: "合言葉を入れてから使ってください" }, { status: 401 });
  }
  const gate = new URL("/gate", request.url);
  gate.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(gate);
}

/** 入口を通ったあと、デモと本番の URL を振り分ける（デモの案件は /demo、本番の案件は /staff でしか開けない） */
function pass(request: NextRequest): NextResponse {
  const route = modeRoute(request.nextUrl.pathname);
  if (!route) return NextResponse.next();
  if (route.kind === "notFound") return new NextResponse("見つかりません", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const url = request.nextUrl.clone();
  url.pathname = route.path;
  return route.kind === "rewrite" ? NextResponse.rewrite(url) : NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
