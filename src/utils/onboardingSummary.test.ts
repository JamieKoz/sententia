import { describe, expect, it } from "vitest";
import { createInitialAnswers } from "../state/machine";
import { formatOnboardingSummary } from "./onboardingSummary";

describe("formatOnboardingSummary", () => {
  it("includes key selections with readable labels", () => {
    const answers = createInitialAnswers({
      moods: ["light", "intense"],
      preferredType: "movie",
      runtime: "short",
      languages: ["en", "fr"],
      familiarities: ["popular", "adults-only"],
      providers: ["netflix"],
      hardExclusions: ["Horror"],
      keywords: ["noir"]
    });

    const rows = Object.fromEntries(formatOnboardingSummary(answers).map((row) => [row.label, row.value]));

    expect(rows.Mood).toBe("Light, Intense");
    expect(rows.Format).toBe("Movie");
    expect(rows.Runtime).toBe("Under 90m");
    expect(rows.Language).toBe("English, French");
    expect(rows.Discovery).toBe("Crowd favourites");
    expect(rows["Watching with"]).toBe("Adults only");
    expect(rows.Provider).toBe("Netflix");
    expect(rows.Avoid).toBe("Horror");
    expect(rows.Keywords).toBe("noir");
  });
});
