import { tmdbWatchRegion } from "../config/regions";
import { mapTmdbProvidersToCanonical, type TmdbWatchProviderEntry } from "./tmdbProviderMap";

const API_BASE = "/api/tmdb/3";

interface TmdbWatchProvidersBucket {
  flatrate?: TmdbWatchProviderEntry[];
  rent?: TmdbWatchProviderEntry[];
  buy?: TmdbWatchProviderEntry[];
}

interface TmdbWatchProvidersResponse {
  results?: Record<string, TmdbWatchProvidersBucket>;
}

export function parseTmdbCatalogId(id: string): { mediaType: "movie" | "tv"; tmdbId: number } | null {
  const match = id.match(/^tmdb-(movie|tv)-(\d+)$/);
  if (!match) return null;
  const tmdbId = Number(match[2]);
  if (!Number.isFinite(tmdbId)) return null;
  return { mediaType: match[1] as "movie" | "tv", tmdbId };
}

export async function fetchWatchProvidersForTmdbId(
  mediaType: "movie" | "tv",
  tmdbId: number,
  watchRegion: string
): Promise<string[]> {
  const region = tmdbWatchRegion(watchRegion);
  const response = await fetch(`${API_BASE}/${mediaType}/${tmdbId}/watch/providers`, {
    headers: { accept: "application/json" }
  });

  if (!response.ok) return [];

  const data = (await response.json()) as TmdbWatchProvidersResponse;
  const bucket = data.results?.[region];
  if (!bucket) return [];

  const entries: TmdbWatchProviderEntry[] = [...(bucket.flatrate ?? [])];
  return mapTmdbProvidersToCanonical(entries);
}
