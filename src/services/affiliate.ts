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
  type?: "movie" | "series";
  /**
   * Optional source identifier. If it contains Amazon Prime Video "gti" (e.g. amzn1.dv.gti.*),
   * we can deep-link directly to the Prime Video detail page.
   */
  id?: string;
  /** Optional Amazon Prime Video deep-link identifier (e.g. amzn1.dv.gti.*). */
  primeVideoGti?: string;
  /** Optional YouTube video ID for the official trailer (from TMDB /videos). */
  youtubeTrailerId?: string;
}

export function amazonTagForRegion(watchRegion: string): string {
  const code = normalizeWatchRegion(watchRegion);
  return AMAZON_TAG_BY_REGION[code] ?? "";
}

export function watchDestination(title: WatchLinkTitle, _watchRegion: string): WatchDestination {
  if (title.providers.includes("prime")) {
    return "amazon";
  }
  return "justwatch";
}

export async function buildWatchUrl(title: WatchLinkTitle, watchRegion: string): Promise<string> {
  const query = encodeURIComponent(`${title.name} ${title.releaseYear}`);
  const region = getWatchRegionOption(watchRegion);

  if (watchDestination(title, watchRegion) === "amazon") {
    const tag = encodeURIComponent(amazonTagForRegion(region.code));
    const gti = getPrimeVideoGti(title);

    // Direct deep-link when we have a confirmed Prime Video identifier.
    if (gti) {
      const tagParams = tag ? `&linkCode=xm2&tag=${tag}` : "";
      return `https://www.primevideo.com/detail?gti=${encodeURIComponent(gti)}${tagParams}`;
    }

    return buildPrimeSearchUrl(query, region.code);

    // Without a GTI/ASIN (requires Amazon PA API to obtain), fall back to a
    // JustWatch title page — a single "Watch on Prime" click from there goes
    // directly to the Prime Video detail page, which is better than a raw
    // Prime Video keyword search.
    //return buildJustWatchUrl(title, region.justwatchLocale, query);
  }

  return await buildJustWatchUrl(title, region.justwatchLocale, query);
}

function getPrimeVideoGti(title: WatchLinkTitle): string | null {
  return (
    title.primeVideoGti?.trim() ||
    title.id?.match(/amzn1\.dv\.gti\.[A-Za-z0-9_-]+/)?.[0] ||
    null
  );
}

async function buildJustWatchUrl(
  title: WatchLinkTitle,
  locale: string,
  query: string
): Promise<string> {
  const searchUrl = `https://www.justwatch.com/${locale}/search?q=${query}`;

  let candidate: string | null = null;

  if (title.type === "movie") {
    candidate = `https://www.justwatch.com/${locale}/movie/${slugifyJustWatchTitle(title.name)}`;
  } else if (title.type === "series") {
    candidate = `https://www.justwatch.com/${locale}/tv-show/${slugifyJustWatchTitle(title.name)}`;
  } else {
    return searchUrl;
  }

  try {
    const response = await fetch(candidate, { method: "HEAD", redirect: "follow" });
    return response.ok ? candidate : searchUrl;
  } catch {
    return searchUrl;
  }
}

function buildPrimeSearchUrl(query: string, regionCode: string): string {
  const tag = encodeURIComponent(amazonTagForRegion(regionCode));
  const tagParams = tag ? `&linkCode=xm2&tag=${tag}` : "";
  return `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${query}${tagParams}`;
}

function slugifyJustWatchTitle(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

export async function openWatchUrl(title: WatchLinkTitle, watchRegion: string): Promise<void> {
  const region = normalizeWatchRegion(watchRegion);
  const destination = watchDestination(title, region);
  const url = await buildWatchUrl(title, region);
  trackWatchClick(title, destination, region);
  window.open(url, "_blank", "noopener,noreferrer");
}

export function buildTrailerDeepLink(title: Pick<WatchLinkTitle, "name" | "releaseYear" | "youtubeTrailerId">): string {
  // Direct link to the specific trailer video when TMDB has resolved the YouTube ID.
  if (title.youtubeTrailerId) {
    return `https://www.youtube.com/watch?v=${encodeURIComponent(title.youtubeTrailerId)}`;
  }
  // Fall back to a YouTube search for the official trailer.
  const query = encodeURIComponent(`${title.name} ${title.releaseYear} official trailer`);
  return `https://www.youtube.com/results?search_query=${query}`;
}

export function openTrailerUrl(title: Pick<WatchLinkTitle, "name" | "releaseYear" | "youtubeTrailerId">): void {
  trackEvent("watch_trailer_click", {
    title: title.name,
    year: title.releaseYear,
    has_video_id: Boolean(title.youtubeTrailerId)
  });
  const url = buildTrailerDeepLink(title);
  window.open(url, "_blank", "noopener,noreferrer");
}
