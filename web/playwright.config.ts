import { defineConfig, devices } from "@playwright/test";

/** 開発サーバー（3200）とぶつからないよう、別のポートで立てる */
const PORT = Number(process.env.E2E_PORT ?? 3300);

/**
 * E2E は本番ビルドを別ポートで立てて行う。
 * AI は呼ばない（費用がかからず、毎回同じ結果になるように API キーを空にして起動する）。
 * 案件の保存場所がメモリ上の1つなので、テストは順番に流す。
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "staff-desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, testMatch: /(staff|console|mode)\.spec\.ts/ },
    { name: "family-mobile", use: { ...devices["Pixel 7"] }, testMatch: /family(-chat)?\.spec\.ts/ },
    { name: "flow", use: { ...devices["Desktop Chrome"] }, testMatch: /flow\.spec\.ts/ },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: { ANTHROPIC_API_KEY: "" },
  },
});
