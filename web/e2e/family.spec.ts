import { expect, test } from "@playwright/test";
import { FAMILY_PATH, addUtterance, confirmDecision, resetCase } from "./helpers";

test.beforeEach(async ({ request }) => resetCase(request));

test("打合せの前は、受付で伺ったこと（喪主・葬儀の形）だけが決まったこととして出る", async ({ page }) => {
  await page.goto(FAMILY_PATH);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("山田家さま");
  await expect(page.getByTestId("decided-chief_mourner")).toContainText("長女");
  await expect(page.getByTestId("decided-funeral_style")).toContainText("家族葬");
  await expect(page.getByRole("status").filter({ hasText: "いつも最新の内容です" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "これから決めること" })).toBeVisible();
});

test("担当者が確定すると、再読み込みなしで遺族の画面に出る", async ({ page, request }) => {
  await page.goto(FAMILY_PATH);
  await expect(page.getByText("いつも最新の内容です")).toBeVisible();
  await confirmDecision(request, "funeral_style", "家族葬");
  const card = page.getByTestId("decided-funeral_style");
  await expect(card).toBeVisible();
  await expect(card).toContainText("家族葬");
});

test("会話の書き起こしや AI の候補は遺族の画面に出ない", async ({ page, request }) => {
  const secret = "正直、費用はできるだけ抑えたいんですけど";
  await addUtterance(request, secret);
  await page.goto(FAMILY_PATH);
  await expect(page.getByText("いつも最新の内容です")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(secret);
  const api = await request.get(`/api/family/yamada-k7m2q9`);
  expect(await api.text()).not.toContain(secret);
});

test("質問を送ると、送ったものに『届いています』と出る", async ({ page }) => {
  await page.goto(FAMILY_PATH);
  await page.getByLabel("聞きたいこと").fill("数珠は持っていったほうがよいですか");
  await page.getByRole("button", { name: "担当者に送る" }).click();
  await expect(page.getByRole("status").filter({ hasText: "担当者に届きました" })).toBeVisible();
  await expect(page.getByTestId("sent-Q1")).toContainText("担当者に届いています");
});

test("決まったことの『変更をお願いする』から、その決定を選んだ状態で書ける", async ({ page, request }) => {
  await confirmDecision(request, "funeral_style", "家族葬");
  await page.goto(FAMILY_PATH);
  await page.getByTestId("decided-funeral_style").getByRole("button", { name: "変更をお願いする" }).click();
  await expect(page.getByRole("radio", { name: "変えたいこと" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByLabel("どの決定についてですか")).toHaveValue("funeral_style");
  await page.getByLabel("どのように変えたいですか").fill("親戚が増えそうなので、一般葬も考えたい");
  await page.getByRole("button", { name: "担当者に送る" }).click();
  await expect(page.getByTestId("sent-Q1")).toContainText("一般葬も考えたい");
  // 送っただけでは決定は変わらない
  await expect(page.getByTestId("decided-funeral_style")).toContainText("家族葬");
});

test("空のままでは送れず、長すぎるときは数で知らせる", async ({ page }) => {
  await page.goto(FAMILY_PATH);
  const send = page.getByRole("button", { name: "担当者に送る" });
  await expect(send).toBeDisabled();
  await page.getByLabel("聞きたいこと").fill("あ".repeat(501));
  await expect(page.getByText("501 / 500")).toBeVisible();
  await expect(send).toBeDisabled();
});

test("決まったことがあれば『変えたいこと』を選べる", async ({ page }) => {
  await page.goto(FAMILY_PATH);
  await expect(page.getByRole("radio", { name: "変えたいこと" })).toBeEnabled();
});

test("無効なリンクでは、案件の中身を出さずに案内だけを出す", async ({ page }) => {
  await page.goto("/f/no-such-token");
  await expect(page.getByText("このリンクは使えません")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("山田家");
});

test("スマホの幅で横にはみ出さない", async ({ page, request }) => {
  await confirmDecision(request, "funeral_style", "家族葬");
  await page.goto(FAMILY_PATH);
  await expect(page.getByTestId("decided-funeral_style")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("担当者が「見せる」にしたお願いだけが窓口に出て、ご家族が済みの印を付けられる", async ({ page, request }) => {
  const add = async (text: string, shared: boolean) =>
    (await (await request.post("/api/cases/demo-yamada/family-tasks", { data: { action: "add", kind: "prepare", text, shared } })).json()) as { data: { familyTasks: { id: string; text: string }[] } };
  await add("まだ見せない下書き", false);
  await add("遺影に使うお写真を1〜2枚", true);
  await page.goto(FAMILY_PATH);
  const list = page.getByTestId("family-task-list");
  await expect(list).toContainText("遺影に使うお写真を1〜2枚");
  await expect(list).not.toContainText("まだ見せない下書き");
  await list.getByRole("checkbox", { name: "遺影に使うお写真を1〜2枚" }).check();
  await expect(list.getByRole("checkbox", { name: "遺影に使うお写真を1〜2枚" })).toBeChecked();
});
