import { expect, test } from "@playwright/test";

/** 担当者の画面：打合せの再生から、お別れの仕方の推奨、プランの案と祭壇のイメージまで */
test("担当者の画面", async ({ page, request }) => {
  await request.post("/api/cases/demo-yamada/reset");
  await page.goto("/staff/demo-yamada");
  await page.getByRole("button", { name: "▶ 打合せを再生" }).click();
  // 台本を流し終えると、推奨が自動で始まる。推奨と判定役の応答を待つ
  await expect(page.getByText("家族が望んでいるお別れ")).toBeVisible({ timeout: 180_000 });
  await page.waitForTimeout(2500);
  await page.getByText("根拠を見る").first().click();
  await page.waitForTimeout(2500);

  await request.post("/api/cases/demo-yamada/decisions", { data: { decisionId: "flower_color", value: "母の好きだった紫を入れて" } });
  await page.getByRole("tab", { name: "プランの案" }).click();
  await expect(page.getByTestId("altar-preview")).toBeVisible();
  await page.waitForTimeout(3000);
  await page.getByRole("tab", { name: "手配と書き出し" }).click();
  await page.waitForTimeout(2500);
});
