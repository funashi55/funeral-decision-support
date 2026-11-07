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
