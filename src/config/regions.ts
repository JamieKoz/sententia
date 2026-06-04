export type WatchRegionCode = "US" | "AU" | "GB" | "CA" | "DE" | "FR" | "NZ";

export interface WatchRegionOption {
  code: WatchRegionCode;
  label: string;
  justwatchLocale: string;
  amazonHost: string;
}

export const DEFAULT_WATCH_REGION: WatchRegionCode = "US";

export const WATCH_REGION_OPTIONS: WatchRegionOption[] = [
  { code: "US", label: "United States", justwatchLocale: "us", amazonHost: "www.amazon.com" },
  { code: "AU", label: "Australia", justwatchLocale: "au", amazonHost: "www.amazon.com.au" },
  { code: "GB", label: "United Kingdom", justwatchLocale: "uk", amazonHost: "www.amazon.co.uk" },
  { code: "CA", label: "Canada", justwatchLocale: "ca", amazonHost: "www.amazon.ca" },
  { code: "DE", label: "Germany", justwatchLocale: "de", amazonHost: "www.amazon.de" },
  { code: "FR", label: "France", justwatchLocale: "fr", amazonHost: "www.amazon.fr" },
  { code: "NZ", label: "New Zealand", justwatchLocale: "nz", amazonHost: "www.amazon.com.au" }
];

const BY_CODE = new Map(WATCH_REGION_OPTIONS.map((r) => [r.code, r]));

/** ISO 3166-1 alpha-2 from Cloudflare / manual picker. */
export function normalizeWatchRegion(raw: string | null | undefined): WatchRegionCode {
  const code = raw?.trim().toUpperCase();
  if (code && BY_CODE.has(code as WatchRegionCode)) return code as WatchRegionCode;
  return DEFAULT_WATCH_REGION;
}

export function getWatchRegionOption(code: string): WatchRegionOption {
  return BY_CODE.get(normalizeWatchRegion(code)) ?? BY_CODE.get(DEFAULT_WATCH_REGION)!;
}

export function watchRegionLabel(code: string): string {
  return getWatchRegionOption(code).label;
}

/** TMDB `watch_region` uses the same ISO country codes. */
export function tmdbWatchRegion(code: string): WatchRegionCode {
  return normalizeWatchRegion(code);
}
