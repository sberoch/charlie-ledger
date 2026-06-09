import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// NestJS relies on emitted decorator metadata for DI; the swc plugin supplies it
// so `Test.createTestingModule(...)` works under vitest (esbuild alone drops it).
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    root: "./",
    include: ["src/**/*.{test,spec}.ts"],
  },
  plugins: [swc.vite({ module: { type: "es6" } })],
});
