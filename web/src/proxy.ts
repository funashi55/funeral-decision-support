import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, accessDigest, isOpenPath } from "./server/access";

/** 試用の入口：合言葉を入れた人だけが担当者の画面・ベテランの回答ページ・API を使える */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const code = process.env.ACCESS_CODE;
  const { pathname, search } = request.nextUrl;
  if (!code || isOpenPath(pathname)) return NextResponse.next();
  const cookie = request.cookies.get(ACCESS_COOKIE)?.value;
  if (cookie && cookie === (await accessDigest(code))) return NextResponse.next();
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ success: false, error: "合言葉を入れてから使ってください" }, { status: 401 });
  }
  const gate = new URL("/gate", request.url);
  gate.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(gate);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
