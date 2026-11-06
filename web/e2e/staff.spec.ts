import { expect, test } from "@playwright/test";
import { confirmDecision, resetCase } from "./helpers";

test.beforeEach(async ({ request }) => resetCase(request));

test("担当者の画面は「いま」から始まり、決めることに切り替えられる", async ({ page }) => {
  await page.goto("/staff/demo-yamada");
  await expect(page.getByText("山田家")).toBeVisible();
  await expect(page.getByRole("heading", { name: "次にすること" })).toBeVisible();
  await page.getByRole("tab", { name: /決めること/ }).click();
  await expect(page.getByRole("heading", { name: "決めることボード" })).toBeVisible();
  await expect(page.getByRole("button", { name: "▶ 打合せを再生" })).toBeEnabled();
});

test("確定した決定はボードに『確定』と出る", async ({ page, request }) => {
  await page.goto("/staff/demo-yamada");
  await expect(page.getByRole("heading", { name: "次にすること" })).toBeVisible();
  await confirmDecision(request, "funeral_style", "家族葬");
  await expect(page.getByLabel("決まったこと")).toContainText("家族葬");
});

test("ご家族の窓口を開くと、共有のリンクと QR コードが出る", async ({ page }) => {
  await page.goto("/staff/demo-yamada");
  await page.getByRole("button", { name: "ご家族の窓口" }).click();
  const drawer = page.getByRole("dialog", { name: "ご家族の窓口" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("img", { name: /QR コード/ })).toBeVisible();
  await expect(drawer.getByRole("link")).toHaveAttribute("href", /\/f\/yamada-k7m2q9$/);
  await drawer.getByRole("button", { name: "閉じる" }).click();
  await expect(drawer).toBeHidden();
});

test("AI が使えないときは、画面を壊さずに理由を出す", async ({ page }) => {
  await page.goto("/staff/demo-yamada");
  await page.getByRole("button", { name: "1行すすめる" }).click();
  await expect(page.getByText("このたびはご愁傷さまでございます")).toBeVisible();
  await expect(page.getByText(/API キー未設定/).first()).toBeVisible();
});
