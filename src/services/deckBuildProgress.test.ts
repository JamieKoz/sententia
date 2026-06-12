import { describe, expect, it, vi } from "vitest";
import {
  DeckBuildProgressReporter,
  createInitialDeckBuildProgress,
  deckBuildStatusLine
} from "./deckBuildProgress";

describe("deckBuildStatusLine", () => {
  it("reflects streaming and resolve phases", () => {
    expect(deckBuildStatusLine(createInitialDeckBuildProgress())).toContain("Asking AI");
    expect(
      deckBuildStatusLine({
        ...createInitialDeckBuildProgress(),
        phase: "suggesting",
        suggestedCount: 3
      })
    ).toContain("3");
    expect(
      deckBuildStatusLine({
        ...createInitialDeckBuildProgress(),
        phase: "resolving",
        resolvedCount: 2,
        targetCount: 10
      })
    ).toContain("2 of 10");
  });
});

describe("DeckBuildProgressReporter", () => {
  it("emits suggestion and resolved updates", () => {
    const onProgress = vi.fn();
    const reporter = new DeckBuildProgressReporter(onProgress, 10);
    reporter.noteSuggestion("Inception");
    reporter.noteResolved({ name: "Inception", type: "movie", posterPath: "/inception.jpg" });

    const last = onProgress.mock.calls.at(-1)?.[0];
    expect(last?.suggestedCount).toBe(1);
    expect(last?.resolvedCount).toBe(1);
    expect(last?.recentSuggestions).toEqual(["Inception"]);
    expect(last?.recentResolved[0]?.name).toBe("Inception");
  });
});
