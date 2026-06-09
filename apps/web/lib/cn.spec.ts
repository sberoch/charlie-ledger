import { describe, expect, it } from "vitest";
import { cn } from "@workspace/ui/lib/utils";

// Smoke test across the workspace boundary: web pulls `cn` from @workspace/ui,
// proving the shared package resolves and tailwind-merge dedupes as expected.
describe("cn", () => {
  it("joins class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("dedupes conflicting tailwind classes (last wins)", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});
