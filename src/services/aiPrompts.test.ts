import { describe, expect, it } from "vitest";
import { createDefaultProfile } from "../engine/profile";
import { createInitialAnswers } from "../state/machine";
import { buildGeneratePrompt, buildRerankPrompt } from "./aiPrompts";
import type { Title } from "../types";

const sampleTitle: Title = {
  id: "t1",
  name: "Sample",
  type: "movie",
  runtimeMinutes: 100,
  genres: ["comedy"],
  moods: ["light"],
  language: "en",
  providers: ["netflix"],
  popularity: 0.7,
  releaseYear: 2021,
  overview: "A film about testing prompts and long overview text that should be truncated in the payload.",
  rating: 7.2,
  cast: ["Actor One", "Actor Two"]
};

describe("buildRerankPrompt", () => {
  it("includes extended title fields and onboarding keys", () => {
    const answers = createInitialAnswers({
      releaseWindow: "2020s",
      keywords: ["space"],
      hardExclusions: ["horror"]
    });
    const profile = createDefaultProfile();
    const raw = buildRerankPrompt({
      answers,
      profile,
      candidates: [sampleTitle],
      watchRegion: "AU",
      historyHints: {
        likedSample: ["Inception"],
        rejectedSample: [],
        seenSample: [],
        sessionCount: 3
      }
    });
    const payload = JSON.parse(raw) as {
      watchRegion?: { code: string };
      onboarding: Record<string, unknown>;
      candidates: Array<Record<string, unknown>>;
      history: Record<string, unknown>;
    };
    expect(payload.onboarding.releaseWindow).toBe("2020s");
    expect(payload.onboarding.keywords).toEqual(["space"]);
    expect(payload.candidates[0].releaseYear).toBe(2021);
    expect(payload.candidates[0].rating).toBe(7.2);
    expect(String(payload.candidates[0].overview).length).toBeLessThanOrEqual(360);
    expect(payload.candidates[0].cast).toEqual(["Actor One", "Actor Two"]);
    expect(payload.history?.sessionCount).toBe(3);
    expect(payload.watchRegion?.code).toBe("AU");
  });
});

describe("buildGeneratePrompt", () => {
  it("embeds personalization ids and session count", () => {
    const profile = createDefaultProfile();
    profile.likedIds = ["a", "b"];
    profile.sessionCount = 5;
    profile.lastChosenTitle = "winner-1";
    const raw = buildGeneratePrompt({
      answers: createInitialAnswers(),
      profile,
      count: 5,
      watchRegion: "US",
      historyHints: {
        likedSample: ["X"],
        rejectedSample: [],
        seenSample: [],
        sessionCount: 5
      }
    });
    const payload = JSON.parse(raw) as {
      watchRegion?: string;
      profileSignals: Record<string, unknown>;
    };
    expect(payload.profileSignals.likedIds).toEqual(["a", "b"]);
    expect(payload.profileSignals.sessionCount).toBe(5);
    expect(payload.profileSignals.lastChosenTitle).toBe("winner-1");
    expect(payload.watchRegion).toBe("US");
  });
});
