import { describe, it, expect } from "vitest";
import { appData } from "@/src/lib/constants";

describe("appData constants", () => {
  it("has the correct app name", () => {
    expect(appData.name).toBe("Luratha");
  });

  it("has the correct logo path", () => {
    expect(appData.logo).toBe("/luratha.svg");
  });

  it("exports all required fields", () => {
    expect(appData).toHaveProperty("name");
    expect(appData).toHaveProperty("logo");
  });
});
