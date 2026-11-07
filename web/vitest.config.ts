import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["src/**/*.test.ts", "redteam/**/*.test.ts", "scripts/**/*.test.ts"] },
});
