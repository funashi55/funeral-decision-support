import { expect, test } from "@playwright/test";

/** 夜のスマホ（デモ動画 1:55–2:10）：決まったことを確かめ、左下の「尋ねる」から案内役に尋ねる */
test("ご家族の窓口", async ({ page, request }) => {
  const confirm = (decisionId: string, value: string) => request.post("/api/cases/demo-yamada/decisions", { data: { decisionId, value } });
  await confirm("funeral_style", "家族葬");
  await confirm("cremation_date", "11月10日 午前10時 中央斎場");
  const link = (await (await request.get("/api/cases/demo-yamada")).json()) as { data?: { familyToken?: string } };
  await page.goto(`/f/${link.data?.familyToken ?? "yamada-k7m2q9"}`);
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: "窓口の案内役に尋ねる" }).click();
  for (const q of ["火葬は何時からでしたか", "湯灌はしたほうがいいでしょうか"]) {
    await page.getByRole("textbox", { name: "尋ねたいこと" }).fill(q);
    await page.getByRole("button", { name: "尋ねる", exact: true }).click();
    await expect(page.getByLabel("お返事を考えています")).toBeHidden({ timeout: 90_000 });
    await page.waitForTimeout(3500);
  }
});
