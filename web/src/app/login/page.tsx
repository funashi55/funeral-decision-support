import type { Metadata } from "next";
import { Suspense } from "react";
import s from "../../components/cases/cases.module.css";
import { safeNext } from "../../server/access";

export const metadata: Metadata = { title: "ログイン｜sou-buddy", robots: { index: false, follow: false } };

const ERRORS: Readonly<Record<string, string>> = {
  setup: "Google ログインの設定がまだです（GOOGLE_CLIENT_ID・GOOGLE_CLIENT_SECRET・AUTH_SECRET）。",
  cancelled: "ログインを取りやめました。",
  state: "ログインの途中で時間が切れました。もう一度お試しください。",
  token: "Google の確認がうまくいきませんでした。もう一度お試しください。",
  denied: "このアカウントでは入れません。管理者に、使うメールアドレスを登録してもらってください。",
};

async function LoginBody({ searchParams }: { readonly searchParams: PageProps<"/login">["searchParams"] }) {
  const { next, error } = await searchParams;
  const href = `/api/auth/google?next=${encodeURIComponent(safeNext(typeof next === "string" ? next : undefined))}`;
  const message = typeof error === "string" ? ERRORS[error] : undefined;
  return (
    <>
      {message && (
        <p className={s.error} role="alert">
          {message}
        </p>
      )}
      <a className={s.primary} href={href}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path fill="#fff" d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.67 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.95S8.78 6.28 12 6.28c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.68 3.74 14.55 2.8 12 2.8 6.92 2.8 2.8 6.92 2.8 12s4.12 9.2 9.2 9.2c5.31 0 8.83-3.73 8.83-8.99 0-.6-.07-1.06-.15-1.51Z" />
        </svg>
        Google でログイン
      </a>
    </>
  );
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <main className={s.page}>
      <div className={s.column} style={{ maxWidth: 460, paddingTop: "10vh" }}>
        <p className={s.eyebrow}>sou-buddy</p>
        <h1 className={s.title}>ログイン</h1>
        <p className={s.lead}>担当者の画面は、登録された Google アカウントで入ります。ご家族の窓口（共有のリンク）はログインなしで開けます。</p>
        <Suspense fallback={null}>
          <LoginBody searchParams={props.searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
