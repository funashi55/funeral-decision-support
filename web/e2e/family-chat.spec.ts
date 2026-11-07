import { expect, test } from "@playwright/test";
import { FAMILY_PATH, resetCase } from "./helpers";

test.beforeEach(async ({ request }) => resetCase(request));

test("案内役が使えないときは、担当者に送る方法を案内し、画面を壊さない", async ({ page }) => {
  await page.goto(FAMILY_PATH);
  await page.getByRole("button", { name: "窓口の案内役に尋ねる" }).click();
  await page.getByRole("textbox", { name: "尋ねたいこと" }).fill("火葬は何時からでしたか");
  await page.getByRole("button", { name: "尋ねる", exact: true }).click();
  await expect(page.getByText(/案内役がお返事できません/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "山田家さま" })).toBeVisible();
});

test("止めたリンクでは窓口の案内役も使えない", async ({ request }) => {
  await request.post("/api/cases/demo-yamada/family-link", { data: { action: "revoke" } });
  const res = await request.post(`/api/family/yamada-k7m2q9/chat`, { data: { text: "こんにちは" } });
  expect(res.status()).toBe(404);
});
