import { describe, expect, it } from "vitest";
import { ApiGateError, apiGateUserMessage, isOpenAiCompletionsUrl } from "./apiErrors";

describe("isOpenAiCompletionsUrl", () => {
  it("matches the worker OpenAI path", () => {
    expect(isOpenAiCompletionsUrl("/api/openai/chat/completions")).toBe(true);
    expect(isOpenAiCompletionsUrl("/api/config")).toBe(false);
  });
});

describe("apiGateUserMessage", () => {
  it("maps rate limit errors", () => {
    const msg = apiGateUserMessage(new ApiGateError("x", 429, "rate_limit"));
    expect(msg).toContain("deck limit");
  });

  it("returns null for unrelated errors", () => {
    expect(apiGateUserMessage(new Error("nope"))).toBeNull();
  });
});
