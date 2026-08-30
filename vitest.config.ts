import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["test/**/*.test.ts"],
    // Domain and application code is deliberately DOM-free, so these run in
    // plain Node. Presentation is covered by the manual checks in the README.
    environment: "node",
  },
});
