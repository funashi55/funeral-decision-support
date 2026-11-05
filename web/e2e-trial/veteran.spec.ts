import { expect, test } from "@playwright/test";
import { enter } from "./helpers";

test("ベテランは場面に答えて送れ、送った答えを取り出せる", async ({ page }) => {
  await enter(page, "/veteran");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("お別れの仕方");
  await page.getByLabel(/お名前/).first().fill("ベテランA");

  const scene = page.getByRole("region", { name: "孫の到着を待ちたい" });
  for (const option of ["通常の納棺", "湯灌", "エンバーミング", "火葬までの日を延ばして"]) {
    await scene.getByRole("group", { name: new RegExp(option) }).getByText("尋ねてみる").click();
  }
  await scene.getByLabel("なぜそう判断したか").fill("まず日にちを聞く");
  await expect(page.getByText("答えた場面 1 / 10")).toBeVisible();

  // 途中で閉じても答えが残る
  await page.reload();
  await expect(page.getByText("答えた場面 1 / 10")).toBeVisible();

  await page.getByRole("button", { name: "答えを送る", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "受け取りました" })).toBeVisible();

  const res = await page.request.get("/api/veteran/answers");
  const body = (await res.json()) as { data: { submissions: { respondent: string; scenes: Record<string, { reason: string }> }[] } };
  const mine = body.data.submissions.find((s) => s.respondent === "ベテランA");
  expect(mine?.scenes.J01?.reason).toBe("まず日にちを聞く");
});

test("スマホの幅で横にはみ出さない", async ({ page }) => {
  await enter(page, "/veteran");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
