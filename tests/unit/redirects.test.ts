import { describe, expect, it } from "vitest";
import { parseDateOnly } from "@/server/identity/policy";
import { safeWorkspacePath } from "@/server/http/redirects";

describe("dates and redirects", () => {
  it("rejects calendar dates that do not exist", () => {
    expect(parseDateOnly("2026-02-31")).toBeNull();
    expect(parseDateOnly("2002-04-12")?.toISOString()).toBe("2002-04-12T00:00:00.000Z");
  });

  it("keeps post-login redirects inside the workspace", () => {
    expect(safeWorkspacePath("/workspace/profile")).toBe("/workspace/profile");
    expect(safeWorkspacePath("https://example.com")).toBe("/workspace");
    expect(safeWorkspacePath("//example.com")).toBe("/workspace");
    expect(safeWorkspacePath("/workspace/../login")).toBe("/workspace");
  });
});
