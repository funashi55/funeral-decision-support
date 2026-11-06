import Link from "next/link";
import s from "../components/trial/trial.module.css";

const POINTS: readonly { readonly title: string; readonly body: string }[] = [
  { title: "聞きながら考える", body: "ご遺族の言葉が入るたびに、お別れの仕方の見立てを約 2 秒で更新します。" },
  { title: "根拠と守る線", body: "推奨には、会話のどの言葉・どのベテランの知見・どの実績かを添えます。高いプランへの誘導や不安をあおる言い回しは、検査で止めます。" },
  { title: "手配まで", body: "確定した内容から、TODO・受注書・業者ごとの発注書（FAX 用）を下書きします。確定するのは人です。" },
];

export default function Home() {
  return (
    <main className={s.page}>
      <div className={s.column}>
        <p className={s.eyebrow}>BUILT WITH CLAUDE: JAPAN 2026</p>
        <h1 className={s.hero}>
          葬儀の打合せで、
          <br />
          新人のとなりにベテランを。
        </h1>
        <p className={s.lead}>
          遺族が数日のうちに迫られる難しい決定を、ベテランの判断と実データで支える打合せ支援（仮称）です。人物・会話・金額はすべて架空です。
        </p>

        <div className={s.ctaRow}>
          <form method="post" action="/api/trials">
            <button className={s.cta} type="submit">
              担当者の画面を試す
              <span aria-hidden="true">→</span>
            </button>
          </form>
          <Link className={s.ctaSub} href="/staff/demo-yamada">
            共用のデモを見る
          </Link>
        </div>
        <p className={s.ctaNote}>あなた専用の打合せ（山田家・架空）を作ります。「▶ 打合せを再生」で会話が流れ、推奨と根拠が出ます。</p>

        <ul className={s.points}>
          {POINTS.map((p, i) => (
            <li key={p.title}>
              <span className={s.pointNum}>{String(i + 1).padStart(2, "0")}</span>
              <b>{p.title}</b>
              <p>{p.body}</p>
            </li>
          ))}
        </ul>

        <Link className={s.linkCard} href="/veteran">
          <div className={s.linkEyebrow}>ベテランの方へ</div>
          <div className={s.linkTitle}>判断の場面に答える →</div>
          <div className={s.linkSub}>10 の架空の場面で、お別れの仕方をどう見るかを選んでいただきます（15 分ほど）。AI の推奨より先に答えてください。</div>
        </Link>

        <p className={s.notice}>試していただくときは、実在のご家族・故人・会社がわかる名前や事情を入力しないでください。</p>
      </div>
    </main>
  );
}
