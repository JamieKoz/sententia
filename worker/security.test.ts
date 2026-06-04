import { describe, expect, it } from "vitest";
import { dailyLimitKey, parseAiDailyLimit, turnstileTokenFromRequest } from "./security";

describe("dailyLimitKey", () => {
  it("scopes by ip and utc day", () => {
    expect(dailyLimitKey("1.2.3.4", "2026-06-04")).toBe("ai:1.2.3.4:2026-06-04");
  });
});

describe("parseAiDailyLimit", () => {
  it("defaults when missing or invalid", () => {
    expect(parseAiDailyLimit(undefined)).toBe(30);
    expect(parseAiDailyLimit("")).toBe(30);
    expect(parseAiDailyLimit("0")).toBe(30);
    expect(parseAiDailyLimit("nope")).toBe(30);
  });

  it("parses positive integers", () => {
    expect(parseAiDailyLimit("5")).toBe(5);
    expect(parseAiDailyLimit("12.9")).toBe(12);
  });
});

describe("turnstileTokenFromRequest", () => {
  it("reads CF or X header", () => {
    const withCf = new Request("https://x", { headers: { "CF-Turnstile-Token": "abc" } });
    expect(turnstileTokenFromRequest(withCf)).toBe("abc");

    const withX = new Request("https://x", { headers: { "X-Turnstile-Token": "xyz" } });
    expect(turnstileTokenFromRequest(withX)).toBe("xyz");
  });
});
