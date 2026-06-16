import { describe, it, expect } from "vitest";
import { hashEmail, hashExternalId, hashName, hashPhone } from "../hash";

// Vetores SHA-256 (hex) calculados independentemente com node:crypto.
const SHA_FOO_BAR = "0c7e6a405862e402eb76a70f8a26fc732d07c32931e9fae9ab1582911d2e8a3b";
const SHA_PHONE = "a869177964cc68954ffec997bbad30769f8a5a6fdc60f296ddbc60b9347dc416";
const SHA_MARIA = "94aec9fbed989ece189a7e172c9cf41669050495152bc4c1dbf2a38d7fd85627";

describe("metaCapi/hash", () => {
  it("hashEmail trims + lowercases then SHA-256 (known vector)", () => {
    expect(hashEmail("  Foo@Bar.com ")).toBe(SHA_FOO_BAR);
    expect(hashEmail("foo@bar.com")).toBe(SHA_FOO_BAR);
  });

  it("hashPhone keeps digits only (country code) then SHA-256 (known vector)", () => {
    expect(hashPhone("+55 (11) 99999-9999")).toBe(SHA_PHONE);
    expect(hashPhone("5511999999999")).toBe(SHA_PHONE);
  });

  it("hashName trims + lowercases then SHA-256 (known vector)", () => {
    expect(hashName(" Maria ")).toBe(SHA_MARIA);
    expect(hashName("MARIA")).toBe(hashName("maria"));
  });

  it("produces 64-char lowercase hex", () => {
    expect(hashEmail("x@y.com")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns undefined for empty / unusable input", () => {
    expect(hashEmail("   ")).toBeUndefined();
    expect(hashPhone("")).toBeUndefined();
    expect(hashPhone("sem-digitos")).toBeUndefined();
    expect(hashName("  ")).toBeUndefined();
    expect(hashExternalId("")).toBeUndefined();
  });

  it("hashExternalId preserves case (UID é case-sensitive)", () => {
    expect(hashExternalId("AbC123")).not.toBe(hashExternalId("abc123"));
  });
});
