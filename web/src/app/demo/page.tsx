import type { Metadata } from "next";
import { Suspense } from "react";
import { CaseCard } from "../../components/cases/CaseCard";
import s from "../../components/cases/cases.module.css";
import { SystemBar } from "../../components/system/SystemBar";
import { DEMO_CASE_ID } from "../../domain/caseMode";
import { store } from "../../server/store";

export const metadata: Metadata = { title: "デモ｜sou-buddy", robots: { index: false, follow: false } };

/** 共用デモの山田家（架空）。本番の一覧には並べない */
async function DemoCard() {
  const demo = await store.get(DEMO_CASE_ID);
  return <CaseCard state={demo} href={`/demo/${DEMO_CASE_ID}`} meta="架空のご家族・共用のデモ" demo />;
}

/**
 * デモの入口。ここから開く案件はすべて架空のご家族で、本番の案件（/staff）とは URL・一覧・操作が分かれている。
 * デモでだけ、台本の再生と「最初から」が使える。発注書・受注書の発注元も架空の会社になる
 */
export default function DemoPage() {
  return (
    <>
      <SystemBar current="demo" />
      <main className={s.page}>
        <div className={s.column}>
          <div className={s.head}>
            <h1 className={s.title}>デモ</h1>
          </div>
          <p className={s.lead}>
            架空のご家族で、打合せの画面を試せます。ここで入れた会話や決めたことは、本番のご家族の一覧には入りません。
            <br />
            打合せの画面で「▶ 打合せを再生」を押すと、架空の会話が流れて、寄り添いの言葉や見落としの先回りが出ます。
          </p>
          <ul className={s.list} aria-label="デモのご家族">
            <li>
              <Suspense fallback={<p className={s.empty}>読み込んでいます…</p>}>
                <DemoCard />
              </Suspense>
            </li>
          </ul>
          <form action="/api/trials" method="post" className={s.actions}>
            <button type="submit" className={s.primary}>
              自分だけのデモを作る
            </button>
            <span className={s.note}>共用のデモはほかの人も触ります。混ざらないように試したいときに使います。</span>
          </form>
        </div>
      </main>
    </>
  );
}
