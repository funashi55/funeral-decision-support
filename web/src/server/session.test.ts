import { describe, expect, it } from "vitest";
import { checkIdToken, googleAuthConfig, isAllowedEmail, signSession, verifySession, type GoogleAuthConfig } from "./session";

const config: GoogleAuthConfig = { clientId: "cid", clientSecret: "cs", secret: "s3cret", allowed: ["staff@example.com", "@funeral.test"] };
const claims = (over: Record<string, unknown> = {}) => ({ aud: "cid", iss: "https://accounts.google.com", exp: 2_000_000_000, email: "staff@example.com", email_verified: true, name: "担当者", ...over });

describe("ログインのセッション", () => {
  it("署名したセッションは読め、書き換えたり期限が切れたりしたら読めない", async () => {
    const token = await signSession({ email: "a@b.c", name: "A", exp: 2000 }, "k");
    expect(await verifySession(token, "k", 1000)).toEqual({ email: "a@b.c", name: "A", exp: 2000 });
    expect(await verifySession(token, "other", 1000)).toBeNull();
    expect(await verifySession(`${token}x`, "k", 1000)).toBeNull();
    expect(await verifySession(token, "k", 3000)).toBeNull();
    expect(await verifySession(undefined, "k")).toBeNull();
  });

  it("Google の設定がそろったときだけ有効になる", () => {
    expect(googleAuthConfig({})).toBeNull();
    expect(googleAuthConfig({ GOOGLE_CLIENT_ID: "a", GOOGLE_CLIENT_SECRET: "b" })).toBeNull();
    expect(googleAuthConfig({ GOOGLE_CLIENT_ID: "a", GOOGLE_CLIENT_SECRET: "b", AUTH_SECRET: "c", AUTH_ALLOWED_EMAILS: " X@Y.com , @z.jp" })?.allowed).toEqual(["x@y.com", "@z.jp"]);
  });

  it("許可リストはメール単位とドメイン単位で効き、空なら誰でも入れる", () => {
    expect(isAllowedEmail("Staff@Example.com", config.allowed)).toBe(true);
    expect(isAllowedEmail("anyone@funeral.test", config.allowed)).toBe(true);
    expect(isAllowedEmail("x@evil.test", config.allowed)).toBe(false);
    expect(isAllowedEmail("x@evil.test", [])).toBe(true);
  });

  it("id_token の宛先・発行元・期限・メールの確認・許可リストを確かめる", () => {
    expect(checkIdToken(claims(), config, 0)).toEqual({ ok: true, email: "staff@example.com", name: "担当者" });
    expect(checkIdToken(claims({ aud: "other" }), config, 0).ok).toBe(false);
    expect(checkIdToken(claims({ iss: "https://evil.test" }), config, 0).ok).toBe(false);
    expect(checkIdToken(claims({ exp: 1 }), config, 5000).ok).toBe(false);
    expect(checkIdToken(claims({ email_verified: false }), config, 0).ok).toBe(false);
    expect(checkIdToken(claims({ email: "x@evil.test" }), config, 0).ok).toBe(false);
    expect(checkIdToken(null, config, 0).ok).toBe(false);
  });
});
