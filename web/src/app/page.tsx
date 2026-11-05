import Link from "next/link";
import s from "../components/trial/trial.module.css";

export default function Home() {
  return (
    <main className={s.page}>
      <div className={s.column}>
        <p className={s.eyebrow}>BUILT WITH CLAUDE: JAPAN 2026</p>
        <h1 className={s.title}>葬儀の打合せ支援（仮称）</h1>
        <p className={s.lead}>遺族が数日のうちに迫られる難しい決定を、ベテランの判断と実データで支えます。人物・会話・金額はすべて架空です。</p>
        <p className={s.notice}>試していただくときは、実在のご家族・故人・会社がわかる名前や事情を入力しないでください。</p>
        <div className={s.links}>
          <Link className={s.linkCard} href="/veteran">
            <div className={s.linkTitle}>① 判断の場面に答える →</div>
            <div className={s.linkSub}>10の架空の場面で、お別れの仕方をどう見るかを選んでいただきます（15分ほど）。AI の推奨より先に答えてください。</div>
          </Link>
          <form method="post" action="/api/trials">
            <button className={s.linkCard} type="submit" style={{ width: "100%", textAlign: "left", font: "inherit", cursor: "pointer" }}>
              <div className={s.linkTitle}>② 担当者の画面を試す →</div>
              <div className={s.linkSub}>
                あなた専用の新しい打合せ（山田家・架空）を作ります。「デモの会話を流す」で打合せが進み、推奨と根拠が出ます。画面右上から遺族の窓口のリンクも作れます。
              </div>
            </button>
          </form>
          <Link className={s.linkCard} href="/staff/demo-yamada">
            <div className={s.linkTitle}>デモの打合せ（共用）を見る</div>
            <div className={s.linkSub}>発表で使う共用の打合せです。ほかの方と同じ画面を見ることになります。</div>
          </Link>
        </div>
      </div>
    </main>
  );
}
