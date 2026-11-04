import { expect, test } from "@playwright/test";

/** 夜のスマホ：決まったことを確かめ、窓口に尋ね、担当者に回る */
test("ご家族の窓口", async ({ page, request }) => {
  const confirm = (decisionId: string, value: string) => request.post("/api/cases/demo-yamada/decisions", { data: { decisionId, value } });
  await confirm("funeral_style", "家族葬");
  await confirm("cremation_date", "11月10日 午前10時 中央斎場");
  await page.goto("/f/yamada-k7m2q9");
  await page.waitForTimeout(2000);
  for (const q of ["火葬は何時からでしたか", "湯灌はしたほうがいいでしょうか"]) {
    await page.getByRole("textbox", { name: "尋ねたいこと" }).fill(q);
    await page.getByRole("button", { name: "尋ねる" }).click();
    await expect(page.getByRole("button", { name: "尋ねる" })).toBeVisible({ timeout: 90_000 });
    await page.waitForTimeout(3000);
  }
});
