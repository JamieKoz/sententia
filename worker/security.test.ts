import { describe, expect, it, vi } from "vitest";
import { dailyLimitKey, parseAiDailyLimit, readDailyLimitStatus, turnstileTokenFromRequest } from "./security";

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

describe("readDailyLimitStatus", () => {
  it("reports remaining allowance without incrementing", async () => {
    const kv = {
      get: vi.fn(async () => "3"),
      put: vi.fn()
    } as unknown as KVNamespace;

    const status = await readDailyLimitStatus(kv, "1.2.3.4", 5);
    expect(status).toEqual({ allowed: true, count: 3, limit: 5 });
    expect(kv.put).not.toHaveBeenCalled();
  });

  it("reports exhausted quota", async () => {
    const kv = {
      get: vi.fn(async () => "5"),
      put: vi.fn()
    } as unknown as KVNamespace;

    const status = await readDailyLimitStatus(kv, "1.2.3.4", 5);
    expect(status).toEqual({ allowed: false, count: 5, limit: 5 });
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
