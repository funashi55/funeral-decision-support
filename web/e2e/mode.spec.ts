import { expect, test } from "@playwright/test";

/** デモ（架空のご家族）と本番（登録した喪家）は、URL・一覧・操作が分かれている */
test("デモの案件を /staff で開くと /demo へ移り、デモの札と再生の操作が出る", async ({ page }) => {
  await page.goto("/staff/demo-yamada");
  await expect(page).toHaveURL(/\/demo\/demo-yamada$/);
  await expect(page.getByText("デモ・架空のご家族")).toBeVisible();
  await expect(page.getByRole("button", { name: "▶ 打合せを再生" })).toBeVisible();
});

test("本番の一覧にデモの山田家は並ばず、デモの入口に並ぶ", async ({ page }) => {
  await page.goto("/staff");
  await expect(page.getByRole("link", { name: /山田家/ })).toHaveCount(0);
  await page.goto("/demo");
  await expect(page.getByRole("link", { name: /山田家/ })).toBeVisible();
});

test("登録した喪家の画面には、デモの操作も札も出ず、/demo では開けない", async ({ page, request }) => {
  const res = await request.post("/api/cases", {
    data: { familyName: "本番確認", deceased: {}, chiefMourner: { relation: "長女" }, membership: "わからない", funeralStyle: "家族葬", restingPlace: "会館" },
  });
  const { data } = (await res.json()) as { data: { caseId: string } };
  await page.goto(`/staff/${data.caseId}`);
  await expect(page.getByText("本番確認家")).toBeVisible();
  await expect(page.getByRole("group", { name: "デモの操作" })).toHaveCount(0);
  await expect(page.getByText("デモ・架空のご家族")).toHaveCount(0);
  expect((await request.post(`/api/cases/${data.caseId}/reset`)).status()).toBe(403);
  await page.goto(`/demo/${data.caseId}`);
  await expect(page).toHaveURL(new RegExp(`/staff/${data.caseId}$`));
});

test("家名だけで登録でき、受付の事実はあとから確定・書き直せる", async ({ page, request }) => {
  await page.goto("/staff/new");
  await page.getByLabel(/家名/).fill("苗字だけ");
  await page.getByRole("button", { name: /登録して打合せへ/ }).click();
  await expect(page).toHaveURL(/\/staff\/case-/);
  await page.getByRole("tab", { name: /基本情報/ }).click();
  await expect(page.getByTestId("fact-deceasedName")).toContainText("未登録");
  await expect(page.getByText(/未定（決めることの「喪主を誰にするか」で決めます）/)).toBeVisible();
  await page.getByRole("button", { name: "故人のお名前を入れる" }).click();
  await page.getByRole("textbox", { name: "故人のお名前" }).fill("架空 花子");
  await page.getByTestId("fact-deceasedName").getByRole("button", { name: "確定" }).click();
  await expect(page.getByTestId("fact-deceasedName")).toContainText("架空 花子");
  const caseId = page.url().split("/").pop();
  expect((await request.post(`/api/cases/${caseId}/facts`, { data: { key: "mournerPhone", value: "でんわ" } })).status()).toBe(400);
});

test("相談中の画面から、左上の sou-buddy でトップ（デモの入口）へ戻れる", async ({ page }) => {
  await page.goto("/demo/demo-yamada");
  await page.getByTestId("to-top").click();
  await expect(page).toHaveURL(/\/demo$/);
});
