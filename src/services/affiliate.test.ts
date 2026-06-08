import { afterEach, describe, expect, it, vi } from "vitest";

describe("buildWatchUrl", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("uses US Amazon when title is on Prime and US tag is configured", async () => {
    vi.stubEnv("VITE_AMAZON_ASSOCIATE_TAG", "sententia-20");
    vi.stubEnv("VITE_AMAZON_TAG_AU", "");
    const { buildWatchUrl, watchDestination } = await import("./affiliate");
    const title = { name: "Interstellar", releaseYear: 2014, providers: ["prime"] };

    expect(watchDestination(title, "US")).toBe("amazon");
    expect(buildWatchUrl(title, "US")).toBe(
      "https://www.amazon.com/s?k=Interstellar%202014&i=instant-video&tag=sententia-20"
    );
  });

  it("uses AU Amazon host and tag when region is AU", async () => {
    vi.stubEnv("VITE_AMAZON_ASSOCIATE_TAG", "");
    vi.stubEnv("VITE_AMAZON_TAG_AU", "sententiaau-20");
    const { buildWatchUrl } = await import("./affiliate");
    const title = { name: "Interstellar", releaseYear: 2014, providers: ["prime"] };

    expect(buildWatchUrl(title, "AU")).toBe(
      "https://www.amazon.com.au/s?k=Interstellar%202014&i=instant-video&tag=sententiaau-20"
    );
  });

  it("falls back to regional JustWatch when Prime has no affiliate tag", async () => {
    vi.stubEnv("VITE_AMAZON_ASSOCIATE_TAG", "");
    vi.stubEnv("VITE_AMAZON_TAG_US", "");
    vi.stubEnv("VITE_AMAZON_TAG_AU", "");
    const { buildWatchUrl, watchDestination } = await import("./affiliate");
    const title = { name: "Interstellar", releaseYear: 2014, providers: ["prime"] };

    expect(watchDestination(title, "AU")).toBe("justwatch");
    expect(buildWatchUrl(title, "AU")).toBe("https://www.justwatch.com/au/search?q=Interstellar%202014");
  });

  it("uses JustWatch for non-Prime providers with region locale", async () => {
    vi.stubEnv("VITE_AMAZON_ASSOCIATE_TAG", "sententia-20");
    const { buildWatchUrl } = await import("./affiliate");
    expect(buildWatchUrl({ name: "Dune", releaseYear: 2021, providers: ["max"] }, "GB")).toBe(
      "https://www.justwatch.com/uk/search?q=Dune%202021"
    );
  });
});
