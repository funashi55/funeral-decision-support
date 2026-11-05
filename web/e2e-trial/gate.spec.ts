import { expect, test } from "@playwright/test";
import { enter } from "./helpers";

test("合言葉を入れるまでは担当者の画面も API も開けない", async ({ page, request }) => {
  await page.goto("/staff/demo-yamada");
  await expect(page).toHaveURL(/\/gate\?next=%2Fstaff%2Fdemo-yamada/);
  const api = await request.get("/api/cases/demo-yamada");
  expect(api.status()).toBe(401);
});

test("合言葉が違うと入れず、合っていれば元の画面に戻る", async ({ page }) => {
  await page.goto("/staff/demo-yamada");
  await page.getByLabel("合言葉").fill("wrong");
  await page.getByRole("button", { name: "入る" }).click();
  await expect(page.getByRole("alert")).toContainText("合言葉が違います");
  await enter(page, "/staff/demo-yamada");
  await expect(page).toHaveURL(/\/staff\/demo-yamada$/);
});

test("ご家族の窓口は合言葉なしで開ける", async ({ page }) => {
  await page.goto("/f/yamada-k7m2q9");
  await expect(page).toHaveURL(/\/f\/yamada-k7m2q9$/);
});

test("試すたびに自分だけの打合せができ、感想を送れる", async ({ page }) => {
  await enter(page);
  await page.getByRole("button", { name: /担当者の画面を試す/ }).click();
  await expect(page).toHaveURL(/\/staff\/trial-[A-Za-z0-9_-]+$/);
  const first = page.url();

  await page.getByRole("button", { name: "感想を送る" }).click();
  await page.getByLabel("この画面で気づいたこと").fill("推奨の理由がもう少し短いとよい");
  await page.getByRole("button", { name: "送る", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "受け取りました" })).toBeVisible();

  await page.goto("/");
  await page.getByRole("button", { name: /担当者の画面を試す/ }).click();
  await expect(page).toHaveURL(/\/staff\/trial-/);
  expect(page.url()).not.toBe(first);
});
