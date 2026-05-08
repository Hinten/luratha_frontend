import { describe, it, expect } from "vitest";
import { appData, contactData } from "@/src/lib/constants";

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

describe("contactData constants", () => {
  it("has a phone number", () => {
    expect(contactData.phone).toBe("(11) 99999-9999");
  });

  it("has a phoneTel for tel: links", () => {
    expect(contactData.phoneTel).toBe("+5511999999999");
  });

  it("has whatsapp number", () => {
    expect(contactData.whatsapp).toBe("5511999999999");
  });

  it("has social media URLs", () => {
    expect(contactData.facebook).toContain("facebook.com");
    expect(contactData.instagram).toContain("instagram.com");
    expect(contactData.youtube).toContain("youtube.com");
  });
});
