import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    include: ["{app,components,lib,hooks}/**/*.{test,spec}.{ts,tsx}"],
    passWithNoTests: true,
  },
});
