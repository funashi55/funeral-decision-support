import type { Page } from "@playwright/test";
import { TRIAL_TEST_CODE } from "../playwright.trial.config";

export async function enter(page: Page, next = "/"): Promise<void> {
  await page.goto(next);
  await page.getByLabel("合言葉").fill(TRIAL_TEST_CODE);
  await page.getByRole("button", { name: "入る" }).click();
}
