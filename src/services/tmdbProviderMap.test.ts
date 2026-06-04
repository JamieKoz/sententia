import { describe, expect, it } from "vitest";
import { mapTmdbProvidersToCanonical, resolveTitleProviders } from "./tmdbProviderMap";

describe("mapTmdbProvidersToCanonical", () => {
  it("maps known TMDB ids and names", () => {
    expect(
      mapTmdbProvidersToCanonical([
        { provider_id: 8, provider_name: "Netflix" },
        { provider_id: 119, provider_name: "Amazon Prime Video" }
      ])
    ).toEqual(["netflix", "prime"]);
  });

  it("dedupes and ignores unknown providers", () => {
    expect(
      mapTmdbProvidersToCanonical([
        { provider_id: 8, provider_name: "Netflix" },
        { provider_id: 99999, provider_name: "Some Local Service" },
        { provider_id: 337, provider_name: "Disney Plus" }
      ])
    ).toEqual(["netflix", "disney"]);
  });
});

describe("resolveTitleProviders", () => {
  it("prefers regional when present", () => {
    expect(resolveTitleProviders(["netflix"], ["prime"], true)).toEqual(["netflix"]);
  });

  it("falls back only without TMDB binding", () => {
    expect(resolveTitleProviders([], ["hulu"], false)).toEqual(["hulu"]);
    expect(resolveTitleProviders([], ["hulu"], true)).toEqual([]);
  });
});
