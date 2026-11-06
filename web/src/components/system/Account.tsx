import { cookies } from "next/headers";
import { SESSION_COOKIE, googleAuthConfig, verifySession } from "../../server/session";
import s from "./system.module.css";

/** 帯の右端：ログインしている担当者とログアウト。ログインの設定がなければ何も出さない */
export async function Account() {
  const config = googleAuthConfig();
  if (!config) return null;
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value, config.secret);
  if (!session) return null;
  return (
    <form method="post" action="/api/auth/logout" className={s.account}>
      <span title={session.email}>{session.name}</span>
      <button type="submit">ログアウト</button>
    </form>
  );
}
