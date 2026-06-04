import { describe, expect, it } from "vitest";
import { getWatchRegionOption, normalizeWatchRegion } from "./regions";

describe("normalizeWatchRegion", () => {
  it("accepts supported ISO codes", () => {
    expect(normalizeWatchRegion("au")).toBe("AU");
    expect(normalizeWatchRegion("GB")).toBe("GB");
  });

  it("defaults unknown codes to US", () => {
    expect(normalizeWatchRegion("ZZ")).toBe("US");
    expect(normalizeWatchRegion(null)).toBe("US");
  });
});

describe("getWatchRegionOption", () => {
  it("returns AU JustWatch and Amazon hosts", () => {
    const opt = getWatchRegionOption("AU");
    expect(opt.justwatchLocale).toBe("au");
    expect(opt.amazonHost).toBe("www.amazon.com.au");
  });
});
