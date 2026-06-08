import { getWatchRegionOption, normalizeWatchRegion } from "../config/regions";
import { trackEvent } from "./analytics";

/** @deprecated Use VITE_AMAZON_TAG_US — kept for existing deploys. */
const LEGACY_AMAZON_TAG = (import.meta.env.VITE_AMAZON_ASSOCIATE_TAG ?? "").trim();

const AMAZON_TAG_BY_REGION: Record<string, string> = {
  US: (import.meta.env.VITE_AMAZON_TAG_US ?? LEGACY_AMAZON_TAG).trim(),
  AU: (import.meta.env.VITE_AMAZON_TAG_AU ?? "").trim(),
  GB: (import.meta.env.VITE_AMAZON_TAG_GB ?? "").trim(),
  CA: (import.meta.env.VITE_AMAZON_TAG_CA ?? "").trim(),
  DE: (import.meta.env.VITE_AMAZON_TAG_DE ?? "").trim(),
  FR: (import.meta.env.VITE_AMAZON_TAG_FR ?? "").trim(),
  NZ: (import.meta.env.VITE_AMAZON_TAG_NZ ?? import.meta.env.VITE_AMAZON_TAG_AU ?? "").trim()
};

export type WatchDestination = "amazon" | "justwatch";

export interface WatchLinkTitle {
  name: string;
  releaseYear: number;
  providers: string[];
}

export function amazonTagForRegion(watchRegion: string): string {
  const code = normalizeWatchRegion(watchRegion);
  return AMAZON_TAG_BY_REGION[code] ?? "";
}

export function watchDestination(title: WatchLinkTitle, watchRegion: string): WatchDestination {
  if (title.providers.includes("prime") && amazonTagForRegion(watchRegion).length > 0) {
    return "amazon";
  }
  return "justwatch";
}

export function buildWatchUrl(title: WatchLinkTitle, watchRegion: string): string {
  const query = encodeURIComponent(`${title.name} ${title.releaseYear}`);
  const region = getWatchRegionOption(watchRegion);

  if (watchDestination(title, watchRegion) === "amazon") {
    const tag = encodeURIComponent(amazonTagForRegion(region.code));
    return `https://${region.amazonHost}/s?k=${query}&i=instant-video&tag=${tag}`;
  }

  return `https://www.justwatch.com/${region.justwatchLocale}/search?q=${query}`;
}

export function trackWatchClick(
  title: WatchLinkTitle,
  destination: WatchDestination,
  watchRegion: string
): void {
  trackEvent("watch_now_click", {
    destination,
    watch_region: normalizeWatchRegion(watchRegion),
    has_prime: title.providers.includes("prime"),
    provider: title.providers[0] ?? "unknown",
    title: title.name,
    year: title.releaseYear
  });
}

export function openWatchUrl(title: WatchLinkTitle, watchRegion: string): void {
  const region = normalizeWatchRegion(watchRegion);
  const destination = watchDestination(title, region);
  const url = buildWatchUrl(title, region);
  trackWatchClick(title, destination, region);
  window.open(url, "_blank", "noopener,noreferrer");
}

export function buildTrailerUrl(title: Pick<WatchLinkTitle, "name" | "releaseYear">): string {
  const query = encodeURIComponent(`${title.name} ${title.releaseYear} official trailer`);
  return `https://www.youtube.com/results?search_query=${query}`;
}

export function openTrailerUrl(title: Pick<WatchLinkTitle, "name" | "releaseYear">): void {
  trackEvent("watch_trailer_click", {
    title: title.name,
    year: title.releaseYear
  });
  window.open(buildTrailerUrl(title), "_blank", "noopener,noreferrer");
}
