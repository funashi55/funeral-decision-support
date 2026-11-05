import { defineConfig, devices } from "@playwright/test";

const PORT = 3300;

/**
 * 試用の公開と同じ設定（入口の合言葉あり・感想ボタンあり）で立てて確かめる。
 * AI は呼ばない。合言葉はテスト用の値。
 */
export const TRIAL_TEST_CODE = "e2e-trial-code";

export default defineConfig({
  testDir: "./e2e-trial",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "trial-desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
    { name: "trial-mobile", use: { ...devices["Pixel 7"] }, testMatch: /veteran\.spec\.ts/ },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/gate`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: { ANTHROPIC_API_KEY: "", ACCESS_CODE: TRIAL_TEST_CODE, NEXT_PUBLIC_TRIAL_MODE: "1" },
  },
});
