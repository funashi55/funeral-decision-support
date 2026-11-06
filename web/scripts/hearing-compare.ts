/**
 * ロールプレイの聞き取りを、経験年数ごとに並べる（事実だけ。解釈はしない）。
 *   npm run trial:pull のあとに  npx tsx scripts/hearing-compare.ts
 * 入力：docs/private/veteran/hearings.json　出力：docs/private/veteran/hearing-compare.md（公開しない）
 *
 * 並べるもの：ペルソナごとに、
 * - 家族の事情（hidden）のうち、どれをどの順で聞き出したか
 * - 打合せの発言の数
 * - 4つのお別れの仕方の見立て
 * - 本人が「合っている」とした判断（元の発言つき）
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { HEARING_SCENES } from "../src/data/hearingScenes";
import { FAREWELL_OPTIONS } from "../src/domain/farewell";
import type { HearingSubmission } from "../src/server/trialFeedback";

const DIR = path.resolve(__dirname, "../../docs/private/veteran");
const EXPERIENCE_LABEL: Record<string, string> = { under1: "1年未満", "1to3": "1〜3年", "3to10": "3〜10年", over10: "10年以上" };
const FIT_LABEL: Record<string, string> = { suits: "合う", consider: "尋ねる", not_now: "合わない", unknown: "わからない" };

/** 事情ごとに、家族が何番目に話したか（話していなければ null） */
function revealTiming(h: HearingSubmission, hiddenIds: readonly string[]): Record<string, number | null> {
  const timing: Record<string, number | null> = Object.fromEntries(hiddenIds.map((id) => [id, null]));
  h.revealed.forEach((id, i) => {
    if (id in timing) timing[id] = i + 1;
  });
  return timing;
}

function main(): void {
  // 動作確認で送った記録（回答者名が「動作確認」で始まる）は比べない
  const hearings = (JSON.parse(readFileSync(path.join(DIR, "hearings.json"), "utf8")) as HearingSubmission[]).filter((h) => !h.respondent.startsWith("動作確認"));
  const lines: string[] = ["# ロールプレイの聞き取り：経験ごとの比較（事実のみ）", "", `記録 ${hearings.length} 件。同じ人が同じペルソナを何度か送ったときは最後のものを使う。`, ""];
  for (const scene of HEARING_SCENES) {
    const latest = new Map<string, HearingSubmission>();
    for (const h of hearings.filter((x) => x.sceneId === scene.id)) latest.set(h.respondent, h);
    const rows = [...latest.values()].sort((a, b) => a.experience.localeCompare(b.experience));
    if (rows.length === 0) continue;
    const ids = scene.hidden.map((x) => x.id);
    lines.push(`## ${scene.id} ${scene.title}`, "", `骨格：${scene.basis}`, "");
    lines.push(`| 回答者 | 経験 | 発言数 | ${ids.map((id) => id.split("-")[1]).join(" | ")} | ${FAREWELL_OPTIONS.map((o) => o.label).join(" | ")} |`);
    lines.push(`|${" --- |".repeat(3 + ids.length + FAREWELL_OPTIONS.length)}`);
    for (const h of rows) {
      const timing = revealTiming(h, ids);
      const said = h.turns.filter((t) => t.role === "veteran").length;
      lines.push(
        `| ${h.respondent} | ${EXPERIENCE_LABEL[h.experience] ?? h.experience} | ${said} | ${ids.map((id) => (timing[id] ? `${timing[id]}番目` : "—")).join(" | ")} | ${FAREWELL_OPTIONS.map((o) => FIT_LABEL[h.fits[o.id] ?? ""] ?? "—").join(" | ")} |`,
      );
    }
    lines.push("", "事情の列：家族から聞き出した順番（—は聞き出していない）。", "");
    for (const h of rows) {
      const agreed = h.judgments.filter((j) => j.verdict === "agree");
      if (agreed.length === 0 && !h.firstWords) continue;
      lines.push(`### ${h.respondent}（${EXPERIENCE_LABEL[h.experience] ?? h.experience}）`, "");
      if (h.firstWords) lines.push(`- 最初の言葉：「${h.firstWords}」`);
      for (const j of agreed) lines.push(`- ${j.when} → ${j.do}${j.why ? `（理由：${j.why}）` : ""}　「${j.quote}」`);
      lines.push("");
    }
  }
  writeFileSync(path.join(DIR, "hearing-compare.md"), `${lines.join("\n")}\n`);
  process.stdout.write(`${path.join(DIR, "hearing-compare.md")} に書き出しました\n`);
}

main();
