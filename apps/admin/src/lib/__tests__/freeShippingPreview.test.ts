import { describe, it, expect } from "vitest";
import { previewFreeShippingThreshold } from "../freeShippingPreview";

const BASE = { divisor: 0.14, minThreshold: 0, maxThreshold: null, enabled: true };

describe("previewFreeShippingThreshold", () => {
  it("computes threshold = cost / divisor, rounded to cents", () => {
    const result = previewFreeShippingThreshold(10, BASE);
    expect(result).toEqual({ kind: "threshold", value: 71.43, flooredByMin: false });
  });

  it("returns disabled when the rule is off", () => {
    expect(previewFreeShippingThreshold(10, { ...BASE, enabled: false })).toEqual({
      kind: "disabled",
    });
  });

  it("returns invalid for a non-positive shipping cost", () => {
    expect(previewFreeShippingThreshold(0, BASE)).toEqual({ kind: "invalid" });
    expect(previewFreeShippingThreshold(-5, BASE)).toEqual({ kind: "invalid" });
  });

  it("floors the result at minThreshold", () => {
    const result = previewFreeShippingThreshold(2, { ...BASE, minThreshold: 50 });
    // raw = 2 / 0.14 = 14.29 → floored to 50
    expect(result).toEqual({ kind: "threshold", value: 50, flooredByMin: true });
  });

  it("returns over-cap when the threshold exceeds maxThreshold", () => {
    const result = previewFreeShippingThreshold(50, { ...BASE, maxThreshold: 300 });
    // raw = 50 / 0.14 = 357.14 → over the 300 cap
    expect(result).toEqual({ kind: "over-cap" });
  });

  it("keeps the threshold when it is within maxThreshold", () => {
    const result = previewFreeShippingThreshold(10, { ...BASE, maxThreshold: 300 });
    expect(result).toEqual({ kind: "threshold", value: 71.43, flooredByMin: false });
  });
});
