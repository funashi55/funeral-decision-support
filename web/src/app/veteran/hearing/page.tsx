import type { Metadata } from "next";
import { HearingApp } from "../../../components/trial/hearing/HearingApp";
import s from "../../../components/trial/trial.module.css";

export const metadata: Metadata = { title: "打合せのロールプレイ｜葬儀の打合せ支援（仮称）", robots: { index: false, follow: false } };

export default function HearingPage() {
  return (
    <main className={s.page}>
      <div className={s.column}>
        <p className={s.eyebrow}>ROLEPLAY</p>
        <h1 className={s.title}>いつもの打合せを、架空のご家族と</h1>
        <p className={s.lead}>
          Claude がご家族を演じます。あなたは担当者として、いつもどおりに打合せをしてください。終わったら、聞き手が「なぜそうしたか」を2〜3問だけ伺います。
          ご家族は、葬儀社の実際の記録で多い組み合わせ（年齢・続柄・葬儀の形など）をもとにした10組です。年代も家族の事情もさまざまです。経験の長い方にも短い方にも同じご家族と打合せをしていただき、尋ね方や決め方の違いを比べます。
          1組8分ほどで、1組だけでも十分に役立ちます。答え方は「チャット」と「声」から選べ、途中で切り替えられます。
        </p>
        <p className={s.notice}>
          場面のご家族と事情はすべて架空です。実在のご家族や会社がわかる名前・事情は話さないでください。声は文字にするだけで、音声は保存しません。
          ここでの打合せの記録は、AI の推奨と見比べて知見を直すためだけに使います。
        </p>
        <HearingApp />
      </div>
    </main>
  );
}
