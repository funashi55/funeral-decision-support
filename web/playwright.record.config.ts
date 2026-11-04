import { defineConfig, devices } from "@playwright/test";

/**
 * デモ動画の素材を撮る（実際のモデルを呼ぶ。npm run demo:record）。
 * 起動済みの開発サーバー（npm run dev、API キーあり）に対して、操作を録画する。
 */
const BASE = process.env.DEMO_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./demo",
  workers: 1,
  timeout: 300_000,
  reporter: [["list"]],
  outputDir: "../docs/private/recordings",
  use: { baseURL: BASE, video: { mode: "on", size: { width: 1440, height: 900 } }, launchOptions: { slowMo: 250 } },
  projects: [
    { name: "staff", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, testMatch: /staff\.record\.ts/ },
    { name: "family", use: { ...devices["Pixel 7"], video: { mode: "on", size: { width: 412, height: 915 } } }, testMatch: /family\.record\.ts/ },
  ],
});
