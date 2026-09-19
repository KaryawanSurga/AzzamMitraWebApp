import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

const alias = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
  "server-only": fileURLToPath(new URL("./src/test/server-only.ts", import.meta.url)),
};

const shared = {
  globals: true,
  setupFiles: ["./src/test/setup.ts"],
  hookTimeout: 60_000,
  testTimeout: 60_000,
};

const integrationExclude = ["src/**/*.integration.test.ts", "src/**/*.acceptance.test.ts"];

export default defineConfig({
  resolve: { alias },
  test: {
    ...shared,
    projects: [
      {
        resolve: { alias },
        test: {
          ...shared,
          name: "server",
          environment: "node",
          include: ["src/{domain,server,db,lib,config}/**/*.test.{ts,tsx}", "src/app/**/*.test.ts"],
          exclude: [...configDefaults.exclude, ...integrationExclude],
        },
      },
      {
        resolve: { alias },
        test: {
          ...shared,
          name: "ui",
          environment: "jsdom",
          include: ["src/components/**/*.test.{ts,tsx}", "src/app/**/*.test.tsx"],
          exclude: [...configDefaults.exclude, ...integrationExclude],
        },
      },
      {
        resolve: { alias },
        test: {
          ...shared,
          name: "integration",
          environment: "node",
          include: ["src/**/*.integration.test.ts", "src/**/*.acceptance.test.ts"],
          hookTimeout: 120_000,
          testTimeout: 120_000,
        },
      },
    ],
  },
});
