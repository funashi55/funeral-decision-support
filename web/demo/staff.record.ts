import { expect, test } from "@playwright/test";
import { demoSettled } from "../src/engine/fixtures/demoSettled";

/**
 * 担当者の画面（デモ動画 0:30–1:55）：喪家の登録 → 打合せの再生（寄り添い → 見落としの先回り → 提案）→ 手配と発注書
 * 実際のモデルを呼ぶ。出力は毎回変わるので、何回か撮ってきれいに出た回を使う
 */
test("担当者の画面", async ({ page, request }) => {
  await page.addInitScript(() => {
    // ガイドは動画では出さない
    for (const k of ["cases", "register", "console"]) localStorage.setItem(`guide:${k}`, "1");
  });
  await request.post("/api/cases/demo-yamada/reset");

  // 入口：ご家族の一覧 → 登録の画面を見せて、山田家（デモ）の打合せへ
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "ご家族" })).toBeVisible();
  await page.waitForTimeout(1500);
  await page.locator("[data-guide=register]").click();
  await page.getByLabel(/家名/).fill("佐藤");
  await page.getByLabel(/喪主の続柄/).fill("長男");
  await page.waitForTimeout(1500);
  await page.goto("/demo/demo-yamada");

  // 打合せを再生：まず寄り添い、見落としの先回り、お気持ちを伺い終えると提案が開く
  await page.getByRole("button", { name: "▶ 打合せを再生" }).click();
  await expect(page.getByRole("button", { name: /もう一度再生/ })).toBeVisible({ timeout: 240_000 });
  // 推奨が出そろうのを待つ（見立てのカードは、会話でプランに触れると「済んだこと」に畳まれる）
  // 寄り添いの言葉が出るまで待つ（「考えています…」が消えるまで）
  await expect(page.locator("[data-guide=care]")).not.toContainText("考えています", { timeout: 180_000 });
  await page.waitForTimeout(3000);
  await page.locator("[data-guide=care]").scrollIntoViewIfNeeded();
  await page.waitForTimeout(3000);
  const proposal = page.locator("[data-guide=proposal]");
  await proposal.scrollIntoViewIfNeeded();
  if (!(await proposal.evaluate((el) => (el as HTMLDetailsElement).open ?? true))) await proposal.locator("summary").first().click();
  await page.waitForTimeout(3000);
  await page.getByTestId("oversights").scrollIntoViewIfNeeded();
  await page.waitForTimeout(3000);

  // 決めること：会話から出た候補を、担当者が丸を押して確定する（候補ありの表示で上から順に）
  await page.getByRole("tab", { name: /決めること/ }).click();
  await page.getByRole("button", { name: /候補あり/ }).click();
  await page.waitForTimeout(1500);
  for (let i = 0; i < 30; i++) {
    const next = page.getByRole("button", { name: /」で確定する$/ }).first();
    if ((await next.count()) === 0) break;
    await next.click();
    await page.waitForTimeout(700);
  }
  // 会話から拾い切れなかった値だけ、担当者が書き込んだ想定で補う（台本に合わせた架空の値）
  const res = await request.get("/api/cases/demo-yamada");
  const body = (await res.json()) as { data?: { decisions?: Record<string, { status: string }>; registration?: { deceased?: { diedAt?: string } } } };
  const settled = demoSettled(body.data?.registration?.deceased?.diedAt ?? "");
  for (const [decisionId, value] of Object.entries(settled)) {
    if (body.data?.decisions?.[decisionId]?.status === "confirmed") continue;
    await request.post("/api/cases/demo-yamada/decisions", { data: { decisionId, value } });
  }
  await page.getByRole("button", { name: /すべて/ }).click();
  await page.waitForTimeout(2500);
  await page.getByRole("tab", { name: /書類作成/ }).click();
  await page.waitForTimeout(1500);
  const popup = page.waitForEvent("popup");
  await page.getByTestId("orders").locator("li", { hasText: "香典返し" }).getByRole("button", { name: /発注書を作る/ }).click();
  const sheet = await popup;
  await sheet.waitForLoadState();
  await sheet.waitForTimeout(3000);
  // 受注書（施行の親の表）も開く
  await sheet.goto("/demo/demo-yamada/juchu");
  await sheet.waitForTimeout(4000);
});
