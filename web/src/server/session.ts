/**
 * Google でログインした担当者のセッション。cookie に「メール・名前・期限」と、その署名（HMAC-SHA256）を置く。
 * 署名の鍵は環境変数 AUTH_SECRET。proxy（入口）でも読めるよう、Web Crypto だけで書く。
 *
 * Google ログインが有効になるのは、GOOGLE_CLIENT_ID・GOOGLE_CLIENT_SECRET・AUTH_SECRET がそろったときだけ。
 * 入れる人は AUTH_ALLOWED_EMAILS（カンマ区切り。「@example.com」でドメイン単位）で絞る。空なら Google アカウントなら誰でも。
 */
export const SESSION_COOKIE = "fds_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

export interface Session {
  readonly email: string;
  readonly name: string;
  /** 期限（ミリ秒） */
  readonly exp: number;
}

export interface GoogleAuthConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly secret: string;
  readonly allowed: readonly string[];
}

export function googleAuthConfig(env: Readonly<Record<string, string | undefined>> = process.env): GoogleAuthConfig | null {
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  const secret = env.AUTH_SECRET;
  if (!clientId || !clientSecret || !secret) return null;
  const allowed = (env.AUTH_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  return { clientId, clientSecret, secret, allowed };
}

/** このメールで入ってよいか。リストが空なら誰でも。「@example.com」はドメイン単位 */
export function isAllowedEmail(email: string, allowed: readonly string[]): boolean {
  if (allowed.length === 0) return true;
  const e = email.trim().toLowerCase();
  return allowed.some((a) => (a.startsWith("@") ? e.endsWith(a) : e === a));
}

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(text: string): Uint8Array {
  const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data))));
}

/** 長さに左右されない比較（署名の照合に使う） */
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signSession(session: Session, secret: string): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(session)));
  return `${body}.${await hmac(secret, body)}`;
}

/** 署名が合い、期限内のときだけセッションを返す */
export async function verifySession(token: string | undefined, secret: string, now = Date.now()): Promise<Session | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig || !sameText(sig, await hmac(secret, body))) return null;
  try {
    const session = JSON.parse(new TextDecoder().decode(fromB64url(body))) as Partial<Session>;
    if (typeof session.email !== "string" || typeof session.exp !== "number" || session.exp < now) return null;
    return { email: session.email, name: typeof session.name === "string" ? session.name : session.email, exp: session.exp };
  } catch {
    return null;
  }
}

/** ログインの往復で使う使い捨ての値（state と PKCE の verifier） */
export function randomToken(bytes = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function pkceChallenge(verifier: string): Promise<string> {
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(verifier))));
}

/** Google のトークン窓口から直接受け取った id_token の中身を読む（TLS で Google から直接受け取るので、署名の検証は省く：OpenID Connect Core 3.1.3.7） */
export function readIdToken(idToken: string): Record<string, unknown> | null {
  const part = idToken.split(".")[1];
  if (!part) return null;
  try {
    return JSON.parse(new TextDecoder().decode(fromB64url(part))) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export type IdTokenCheck = { readonly ok: true; readonly email: string; readonly name: string } | { readonly ok: false; readonly reason: string };

/** id_token の宛先・発行元・期限・メールの確認・許可リストを確かめる */
export function checkIdToken(claims: Record<string, unknown> | null, config: GoogleAuthConfig, now = Date.now()): IdTokenCheck {
  if (!claims) return { ok: false, reason: "Google からの応答を読めませんでした" };
  if (claims.aud !== config.clientId) return { ok: false, reason: "宛先が違います" };
  if (claims.iss !== "https://accounts.google.com" && claims.iss !== "accounts.google.com") return { ok: false, reason: "発行元が違います" };
  if (typeof claims.exp !== "number" || claims.exp * 1000 < now) return { ok: false, reason: "期限が切れています" };
  const email = typeof claims.email === "string" ? claims.email : "";
  if (!email || claims.email_verified !== true) return { ok: false, reason: "確認済みのメールがありません" };
  if (!isAllowedEmail(email, config.allowed)) return { ok: false, reason: "このアカウントでは入れません" };
  return { ok: true, email, name: typeof claims.name === "string" ? claims.name : email };
}
