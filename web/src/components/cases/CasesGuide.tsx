"use client";
import { Guide, type GuideStep } from "../guide/Guide";

const STEPS: readonly GuideStep[] = [
  { target: "register", title: "施行を登録", body: "お迎えの連絡が入ったら、ここから登録します。家名と喪主の続柄だけで始められます。" },
  { target: "case-card", title: "打合せを開く", body: "カードを押すと、そのご家族の打合せの画面が開きます。棒は、決まった項目の進み具合です。" },
  { target: "nav-demo", title: "デモは別の場所", body: "架空のご家族で試すときは、上の「デモ」から開きます。デモの案件はこの一覧には並びません。" },
];

export function CasesGuide() {
  return <Guide steps={STEPS} storageKey="cases" label="施行一覧" />;
}
