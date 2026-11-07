import { expect, test } from "@playwright/test";
import { CASE_ID, FAMILY_PATH, addUtterance, confirmDecision, resetCase } from "./helpers";

test.beforeEach(async ({ request }) => resetCase(request));

test("メモ入力で発言を足すと、確認・注意に見落としの注意が出る", async ({ page }) => {
  await page.goto(`/demo/${CASE_ID}`);
  await page.getByRole("textbox", { name: "発言の要点" }).fill("新聞のお悔やみ欄にも出したほうがいいんでしょうか");
  await page.getByRole("button", { name: "追加" }).click();

  await expect(page.getByText("新聞のお悔やみ欄にも出したほうがいいんでしょうか")).toBeVisible();
  const oversights = page.getByTestId("oversights");
  // 見出しだけが出て、説明は開いたときに見える
  await expect(oversights.getByText("お悔やみ欄は取り消せない")).toBeVisible();
  await expect(oversights.getByText(/掲載すると取り消せません/)).toBeHidden();
  await oversights.getByText("お悔やみ欄は取り消せない").click();
  await expect(oversights.getByText(/掲載すると取り消せません/)).toBeVisible();

  // 伝えたものは「済んだこと」に畳まれ、戻せる
  await oversights.getByRole("button", { name: "伝えた" }).first().click();
  const handled = page.getByTestId("handled");
  await expect(handled).toContainText("お悔やみ欄");
  await expect(oversights.getByText("お悔やみ欄は取り消せない")).toHaveCount(0);
  await handled.locator("summary").click();
  await handled.getByRole("button", { name: "戻す" }).click();
  await expect(oversights.getByText("お悔やみ欄は取り消せない")).toBeVisible();
});

test("字幕を直すと、直した文が残る", async ({ page, request }) => {
  await addUtterance(request, "お寺はさいこうじです");
  await page.goto(`/demo/${CASE_ID}`);
  await page.getByRole("button", { name: "U1の字幕を直す" }).click();
  await page.getByRole("textbox", { name: "字幕の内容" }).fill("お寺は西光寺です");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByTestId("utt-U1")).toContainText("お寺は西光寺です");
});

test("信頼関係の段階ではプランの金額を出さず、段階が進むと3つの幅の案が費用を抑える順に出る", async ({ page, request }) => {
  await page.goto(`/demo/${CASE_ID}`);
  await page.getByRole("tab", { name: /プランの案/ }).click();
  await expect(page.getByText("まだ案はありません。")).toBeVisible();

  await addUtterance(request, "費用はできるだけ抑えたいです");
  await expect(page.getByTestId("plan-simple")).toBeVisible();
  const ids = await page.locator("[data-testid^=plan-]").evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
  expect(ids).toEqual(["plan-simple", "plan-standard", "plan-gratitude"]);
  await expect(page.getByTestId("plan-simple")).toContainText("円");
  await expect(page.getByTestId("plan-simple")).toContainText("料理（人数が決まってから）");
});

test("確定したものだけが手配に回り、CSV に書き出される", async ({ page, request }) => {
  await confirmDecision(request, "cremation_date", "11月10日 午前10時 中央斎場");
  await page.goto(`/demo/${CASE_ID}`);
  await page.getByRole("tab", { name: /書類作成/ }).click();
  const orders = page.getByTestId("orders");
  await expect(orders.getByText("火葬場の空き確認と予約").locator("..")).toContainText("手配できる");
  await expect(orders.getByText("寺院への連絡").locator("..")).toContainText("確定待ち");

  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: /基幹システム/ }).click();
  const file = await download;
  const path = await file.path();
  const { readFileSync } = await import("node:fs");
  const csv = readFileSync(path, "utf8");
  expect(csv).toContain("火葬日時・利用斎場");
  expect(csv).toContain("11月10日 午前10時 中央斎場");
});

test("窓口のリンクを止めると、遺族のスマホでは開けなくなり、新しいリンクで開ける", async ({ page, browser }) => {
  await page.goto(`/demo/${CASE_ID}`);
  await page.getByRole("button", { name: "ご家族の窓口" }).click();
  const drawer = page.getByRole("dialog", { name: "ご家族の窓口" });
  await drawer.getByRole("button", { name: "リンクを止める" }).click();
  await expect(drawer.getByText("窓口のリンクは止めてあります")).toBeVisible();

  const family = await browser.newPage();
  await family.goto(FAMILY_PATH);
  await expect(family.getByText("このリンクは使えません")).toBeVisible();

  await drawer.getByRole("button", { name: "新しいリンクを発行する" }).click();
  const href = await drawer.getByRole("link").getAttribute("href");
  expect(href).not.toContain(FAMILY_PATH);
  await family.goto(new URL(href ?? "", "http://localhost").pathname);
  await expect(family.getByRole("heading", { name: "山田家さま" })).toBeVisible();
  await family.close();
});

test("マイクでの聞き取りは、ご家族の同意を確かめるまで始まらない", async ({ page }) => {
  await page.goto(`/demo/${CASE_ID}`);
  await page.getByRole("button", { name: "マイクで聞き取る" }).click();
  await expect(page.getByRole("group", { name: "録音の同意" })).toContainText("音声そのものは保存しません");
  await expect(page.getByRole("button", { name: "聞き取りを始める" })).toHaveCount(0);
  await page.getByRole("button", { name: "ご家族の同意をいただいた" }).click();
  await expect(page.getByRole("button", { name: /聞き取りを始める/ })).toBeVisible();
});
