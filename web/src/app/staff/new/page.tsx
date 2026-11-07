import type { Metadata } from "next";
import Link from "next/link";
import s from "../../../components/cases/cases.module.css";
import { RegisterForm } from "../../../components/cases/RegisterForm";
import { SystemBar } from "../../../components/system/SystemBar";

export const metadata: Metadata = { title: "ご家族の登録｜sou-buddy", robots: { index: false, follow: false } };

export default function NewCasePage() {
  return (
    <>
      <SystemBar current="families" />
      <main className={s.page}>
        <div className={s.column}>
          <div className={s.head}>
            <h1 className={s.title}>ご家族を登録</h1>
            <Link className={s.ghost} href="/staff">
              ← 一覧へ
            </Link>
          </div>
          <RegisterForm />
        </div>
      </main>
    </>
  );
}
