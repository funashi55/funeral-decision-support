import { expect, test } from "@playwright/test";

/** バディ：担当者ごとの設定は、開き直しても残る */
test("バディの画面で言葉の調子と支援の量を選ぶと、開き直しても残る", async ({ page }) => {
  await page.goto("/demo/demo-yamada");
  await page.getByRole("tab", { name: "バディ" }).click();
  await expect(page.getByRole("heading", { name: /さんのバディ/ })).toBeVisible();
  await page.getByRole("radio", { name: "短く、端的に" }).click();
  await page.getByRole("radio", { name: "要点だけ（ひとつずつ）" }).click();
  await expect(page.getByRole("radio", { name: "要点だけ（ひとつずつ）" })).toHaveAttribute("aria-checked", "true");

  await page.reload();
  await page.getByRole("tab", { name: "バディ" }).click();
  await expect(page.getByRole("radio", { name: "短く、端的に" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("radio", { name: "要点だけ（ひとつずつ）" })).toHaveAttribute("aria-checked", "true");
});
