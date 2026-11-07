import { expect, test } from "@playwright/test";
import { FAMILY_PATH, confirmDecision, resetCase } from "./helpers";

test.beforeEach(async ({ request }) => resetCase(request));

test("遺族が変更を希望し、担当者が返事をすると、遺族の画面に返事が出る", async ({ browser, request }) => {
  await confirmDecision(request, "funeral_style", "家族葬");

  const familyCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const staffCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const family = await familyCtx.newPage();
  const staff = await staffCtx.newPage();

  await staff.goto("/demo/demo-yamada");
  await family.goto(FAMILY_PATH);

  // 遺族：変更の希望を送る
  await family.getByTestId("decided-funeral_style").getByRole("button", { name: "変更をお願いする" }).click();
  await family.getByLabel("どのように変えたいですか").fill("やはり一日葬も考えたいです");
  await family.getByRole("button", { name: "担当者に送る" }).click();

  // 担当者：未対応の数が出て、引き出しに依頼が届く
  const inboxButton = staff.getByRole("button", { name: /ご家族の窓口/ });
  await expect(inboxButton.getByLabel("未対応 1 件")).toBeVisible();
  await inboxButton.click();
  const req = staff.getByTestId("request-Q1");
  await expect(req).toContainText("やはり一日葬も考えたいです");
  await expect(req).toContainText("決定はまだ変わっていません");
  await req.getByLabel("ご家族への返事").fill("承知しました。明日の打合せで、一日葬の場合の流れをご説明します");
  await req.getByRole("button", { name: "返事をする" }).click();
  await expect(req).toContainText("返事済み");
  await expect(inboxButton.getByLabel(/未対応/)).toHaveCount(0);

  // 遺族：再読み込みなしで返事が届く
  const sent = family.getByTestId("sent-Q1");
  await expect(sent).toContainText("担当者が確認しました");
  await expect(sent).toContainText("一日葬の場合の流れをご説明します");

  await familyCtx.close();
  await staffCtx.close();
});
