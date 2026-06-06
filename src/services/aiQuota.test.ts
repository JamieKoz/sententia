import { describe, expect, it } from "vitest";
import {
  AI_REQUESTS_PER_DECK,
  assertCanBuildAiDeck,
  type AiQuota
} from "./aiQuota";
import { ApiGateError } from "./apiErrors";

describe("assertCanBuildAiDeck", () => {
  it("allows builds when quota is not tracked", () => {
    expect(() => assertCanBuildAiDeck(null)).not.toThrow();
    expect(() =>
      assertCanBuildAiDeck({ count: 99, limit: 30, remaining: 0, limited: false })
    ).not.toThrow();
  });

  it("allows builds when enough requests remain", () => {
    const quota: AiQuota = { count: 2, limit: 30, remaining: 28, limited: true };
    expect(() => assertCanBuildAiDeck(quota)).not.toThrow();
  });

  it("blocks builds when remaining quota is below deck cost", () => {
    const quota: AiQuota = { count: 30, limit: 30, remaining: 0, limited: true };
    expect(() => assertCanBuildAiDeck(quota)).toThrow(ApiGateError);
  });

  it("uses one request per deck", () => {
    expect(AI_REQUESTS_PER_DECK).toBe(1);
  });
});
