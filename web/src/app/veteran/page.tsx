import type { Metadata } from "next";
import { VeteranForm } from "../../components/trial/VeteranForm";
import s from "../../components/trial/trial.module.css";

export const metadata: Metadata = { title: "判断の場面への回答｜葬儀の打合せ支援（仮称）", robots: { index: false, follow: false } };

export default function VeteranPage() {
  return (
    <main className={s.page}>
      <div className={s.column}>
        <p className={s.eyebrow}>FOR VETERANS</p>
        <h1 className={s.title}>打合せの場面ごとに、お別れの仕方をどう見るか教えてください</h1>
        <p className={s.lead}>
          10の場面があります。それぞれ、4つのお別れの仕方について「合う」「尋ねてみる」「今回は合わない」から選んでください。
          正解はありません。いつも現場でされている判断のままで構いません。答えは AI の推奨と見比べて、知見を直すのに使います。
          途中で閉じても、この端末に答えが残ります。
        </p>
        <p className={s.notice}>
          場面の家族と会話はすべて架空です。理由の欄に、実在のご家族や会社がわかる名前・事情は書かないでください。
        </p>
        <VeteranForm />
      </div>
    </main>
  );
}
