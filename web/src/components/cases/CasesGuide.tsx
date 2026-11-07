"use client";
import { Guide, type GuideStep } from "../guide/Guide";

const STEPS: readonly GuideStep[] = [
  { target: "register", title: "ご家族を登録", body: "お迎えの連絡が入ったら、ここから登録します。家名と喪主の続柄だけで始められます。" },
  { target: "case-card", title: "打合せを開く", body: "カードを押すと、そのご家族の打合せの画面が開きます。棒は、決まった項目の進み具合です。" },
  { target: "demo-card", title: "デモで試す", body: "架空の山田家です。打合せの画面で「▶ 打合せを再生」を押すと、会話が流れて提案が出ます。" },
];

export function CasesGuide() {
  return <Guide steps={STEPS} storageKey="cases" label="ご家族の一覧" />;
}
