import type { Metadata } from "next";
import Link from "next/link";
import s from "../../../components/cases/cases.module.css";
import { RegisterForm } from "../../../components/cases/RegisterForm";
import { SystemBar } from "../../../components/system/SystemBar";

export const metadata: Metadata = { title: "ご家族の登録｜葬儀の打合せ支援（仮称）", robots: { index: false, follow: false } };

export default function NewCasePage() {
  return (
    <>
      <SystemBar current="families" />
      <main className={s.page}>
        <div className={s.column}>
          <div className={s.head}>
            <div>
              <p className={s.eyebrow}>受付</p>
              <h1 className={s.title}>新しいご家族を登録</h1>
              <p className={s.lead}>お迎えの連絡で伺ったことを入れます。わからないことは空のままで、打合せで決めます。</p>
            </div>
            <Link className={s.ghost} href="/staff">
              ← ご家族の一覧へ
            </Link>
          </div>
          <RegisterForm />
        </div>
      </main>
    </>
  );
}
