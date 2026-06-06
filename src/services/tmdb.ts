import { passesAiDeckConstraints, passesCandidateConstraints } from "../engine/candidateFilters";
import type { OnboardingAnswers, TasteProfile, Title, TitleType } from "../types";
import { slugify } from "../utils/appState";
import type { AiSuggestedTitle } from "./aiTypes";
import { mapTmdbProvidersToCanonical, resolveTitleProviders } from "./tmdbProviderMap";
import { tmdbWatchRegion } from "../config/regions";
import { fetchWatchProvidersForTmdbId, parseTmdbCatalogId } from "./tmdbWatchProviders";

export function tmdbPosterUrl(posterPath: string | null | undefined, size: "w342" | "w500" = "w500"): string | null {
  if (!posterPath) return null;
  return `https://image.tmdb.org/t/p/${size}${posterPath}`;
}

export interface TmdbSearchResult {
  id: number;
  media_type?: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  poster_path?: string | null;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  vote_average?: number;
}

const API_BASE = "/api/tmdb/3";
let genreLookupPromise: Promise<Map<number, string>> | null = null;
const searchCache = new Map<string, Promise<TmdbSearchResult[]>>();
const detailCache = new Map<string, Promise<TmdbDetailSummary | null>>();
const ENRICH_CONCURRENCY = 4;
const SEARCH_CACHE_MAX_ENTRIES = 200;
const DETAIL_CACHE_MAX_ENTRIES = 400;

export async function searchTmdbTitle(query: string): Promise<TmdbSearchResult[]> {
  const key = query.trim().toLowerCase();
  if (!key) return [];
  let cached = searchCache.get(key);
  if (!cached) {
    cached = (async () => {
      const response = await fetch(`${API_BASE}/search/multi?query=${encodeURIComponent(query)}&include_adult=false`, {
        headers: {
          accept: "application/json"
        }
      });

      if (!response.ok) return [];

      const data = (await response.json()) as { results?: TmdbSearchResult[] };
      return data.results ?? [];
    })();
    setWithLimit(searchCache, key, cached, SEARCH_CACHE_MAX_ENTRIES);
  }
  return cached;
}

export async function enrichTitlesWithTmdb(titles: Title[], watchRegion: string): Promise<Title[]> {
  if (titles.length === 0) return titles;
  const genreLookup = await getGenreLookup();

  const enriched = await mapWithConcurrency(
    titles,
    ENRICH_CONCURRENCY,
    async (title) => {
      const parsed = parseTmdbCatalogId(title.id);
      let mediaType: "movie" | "tv" | undefined = parsed?.mediaType;
      let tmdbId = parsed?.tmdbId;

      const results = await searchTmdbTitle(title.name);
      const best = findBestMatch(results, title);

      if (!mediaType || tmdbId === undefined) {
        if (best?.media_type === "movie" || best?.media_type === "tv") {
          mediaType = best.media_type;
          tmdbId = best.id;
        }
      }

      if (!best && !parsed) return title;

      const year = best
        ? parseYear(best.release_date ?? best.first_air_date) ?? title.releaseYear
        : title.releaseYear;
      const details =
        mediaType && tmdbId !== undefined
          ? await fetchTmdbDetails(mediaType, tmdbId, watchRegion)
          : null;
      const genresFromSearch = best
        ? (best.genre_ids ?? []).map((id) => genreLookup.get(id)).filter((name): name is string => Boolean(name))
        : [];
      const genres = details?.genres?.length ? details.genres : genresFromSearch.length ? genresFromSearch : title.genres;
      const cast = details?.cast?.length ? details.cast : title.cast;
      const rating = details?.voteAverage ?? best?.vote_average ?? title.rating;
      const runtimeMinutes = details?.runtimeMinutes ?? title.runtimeMinutes;
      const regionalProviders =
        details?.providers ??
        (mediaType && tmdbId !== undefined
          ? await fetchWatchProvidersForTmdbId(mediaType, tmdbId, watchRegion)
          : []);

      return {
        ...title,
        id:
          mediaType && tmdbId !== undefined ? `tmdb-${mediaType}-${tmdbId}` : title.id,
        posterPath: details?.posterPath ?? best?.poster_path ?? title.posterPath,
        overview: details?.overview?.trim() || best?.overview?.trim() || title.overview,
        releaseYear: year ?? title.releaseYear,
        genres: genres.length ? genres : title.genres,
        cast,
        rating,
        runtimeMinutes,
        providers: resolveTitleProviders(
          regionalProviders,
          title.providers,
          Boolean(mediaType && tmdbId !== undefined)
        )
      };
    }
  );

  return enriched;
}

export function strictSearchMatch(results: TmdbSearchResult[], titleName: string, type: TitleType): TmdbSearchResult | null {
  if (results.length === 0) return null;
  const expectedMediaType = type === "series" ? "tv" : "movie";
  const filtered = results.filter((result) => result.media_type === "movie" || result.media_type === "tv");
  if (filtered.length === 0) return null;
  const normalizedTarget = normalize(titleName);

  const exact = filtered.find((result) => {
    const candidateName = result.title ?? result.name ?? "";
    return result.media_type === expectedMediaType && normalize(candidateName) === normalizedTarget;
  });
  return exact ?? null;
}

export function createSyntheticAiTitle(
  suggestion: AiSuggestedTitle,
  answers: OnboardingAnswers,
  ordinal: number
): Title {
  return {
    id: `ai-${ordinal}-${slugify(suggestion.name)}`,
    name: suggestion.name,
    type: suggestion.type,
    runtimeMinutes: suggestion.type === "series" ? 45 : 110,
    genres: [],
    moods: [...(answers.moods ?? [])],
    language: answers.languages?.[0] ?? "en",
    providers: [...(answers.providers ?? [])],
    popularity: 0.6,
    releaseYear: new Date().getFullYear(),
    posterPath: null,
    overview: suggestion.reason?.trim() || "AI-picked for your current vibe."
  };
}

export async function resolveAiSuggestionsToTitles(
  suggestions: AiSuggestedTitle[],
  answers: OnboardingAnswers,
  profile: TasteProfile,
  max: number,
  watchRegion: string
): Promise<Title[]> {
  if (suggestions.length === 0) return [];
  const genreLookup = await getGenreLookup();
  const rejectedIds = new Set(profile.rejectedIds);
  const seenIds = new Set(profile.seenIds);

  const candidates = await mapWithConcurrency(
    suggestions,
    ENRICH_CONCURRENCY,
    (suggestion, index) =>
      resolveSuggestionToTitle(suggestion, index, {
        answers,
        watchRegion,
        genreLookup,
        rejectedIds,
        seenIds
      })
  );

  const used = new Set<string>();
  const resolved: Title[] = [];
  for (const title of candidates) {
    if (!title || used.has(title.id)) continue;
    if (!passesAiDeckConstraints(title, answers) || !passesCandidateConstraints(title, answers)) continue;
    used.add(title.id);
    resolved.push(title);
    if (resolved.length >= max) break;
  }

  return resolved;
}

async function resolveSuggestionToTitle(
  suggestion: AiSuggestedTitle,
  index: number,
  context: {
    answers: OnboardingAnswers;
    watchRegion: string;
    genreLookup: Map<number, string>;
    rejectedIds: Set<string>;
    seenIds: Set<string>;
  }
): Promise<Title | null> {
  const { answers, watchRegion, genreLookup, rejectedIds, seenIds } = context;
  const results = await searchTmdbTitle(suggestion.name);
  const match = strictSearchMatch(results, suggestion.name, suggestion.type);
  let picked: Title | null = null;

  if (match && (match.media_type === "movie" || match.media_type === "tv")) {
    const media = match.media_type;
    const id = `tmdb-${media}-${match.id}`;
    if (!rejectedIds.has(id) && !seenIds.has(id)) {
      const details = await fetchTmdbDetails(media, match.id, watchRegion);
      const year = parseYear(match.release_date ?? match.first_air_date);
      const regionalProviders =
        details?.providers ?? (await fetchWatchProvidersForTmdbId(media, match.id, watchRegion));
      const genresFromSearch = (match.genre_ids ?? [])
        .map((gid) => genreLookup.get(gid))
        .filter((name): name is string => Boolean(name));
      const genres = details?.genres?.length ? details.genres : genresFromSearch;
      const resolvedType: TitleType = media === "tv" ? "series" : "movie";
      const displayName = (match.title ?? match.name ?? suggestion.name).trim();

      picked = {
        id,
        name: displayName,
        type: resolvedType,
        runtimeMinutes: details?.runtimeMinutes ?? (resolvedType === "series" ? 45 : 110),
        genres: genres.length ? genres : [],
        moods: [...answers.moods],
        language: answers.languages[0] ?? "en",
        providers: resolveTitleProviders(regionalProviders, answers.providers, true),
        popularity: typeof match.vote_average === "number" ? Math.min(1, match.vote_average / 10) : 0.55,
        releaseYear: year ?? new Date().getFullYear(),
        posterPath: details?.posterPath ?? match.poster_path ?? null,
        overview: details?.overview?.trim() || match.overview?.trim() || suggestion.reason?.trim() || "",
        rating: details?.voteAverage ?? match.vote_average,
        cast: details?.cast
      };
    }
  }

  if (!picked) {
    const synthetic = createSyntheticAiTitle(suggestion, answers, index);
    if (passesAiDeckConstraints(synthetic, answers)) {
      const posterHint = findBestMatch(results, synthetic);
      picked = {
        ...synthetic,
        posterPath: posterHint?.poster_path ?? synthetic.posterPath ?? null,
        releaseYear: parseYear(posterHint?.release_date ?? posterHint?.first_air_date) ?? synthetic.releaseYear
      };
    }
  } else if (!picked.posterPath) {
    const posterHint = findBestMatch(results, picked);
    if (posterHint?.poster_path) {
      picked = { ...picked, posterPath: posterHint.poster_path };
    }
  }

  return picked;
}

function findBestMatch(results: TmdbSearchResult[], title: Title): TmdbSearchResult | null {
  if (results.length === 0) return null;
  const expectedMediaType = title.type === "series" ? "tv" : "movie";
  const filtered = results.filter((result) => result.media_type === "movie" || result.media_type === "tv");
  if (filtered.length === 0) return null;
  const normalizedTarget = normalize(title.name);

  const exact = filtered.find((result) => {
    const candidateName = result.title ?? result.name ?? "";
    return result.media_type === expectedMediaType && normalize(candidateName) === normalizedTarget;
  });
  if (exact) return exact;

  const sameType = filtered.find((result) => result.media_type === expectedMediaType && Boolean(result.poster_path));
  if (sameType) return sameType;

  return filtered.find((result) => Boolean(result.poster_path)) ?? filtered[0] ?? null;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseYear(date: string | undefined): number | undefined {
  if (!date) return undefined;
  const year = Number(date.slice(0, 4));
  return Number.isFinite(year) ? year : undefined;
}

interface TmdbDetailResponse {
  overview?: string;
  poster_path?: string | null;
  genres?: Array<{ id: number; name: string }>;
  vote_average?: number;
  runtime?: number;
  episode_run_time?: number[];
  credits?: { cast?: Array<{ name?: string }> };
}

interface TmdbDetailSummary {
  overview?: string;
  posterPath?: string | null;
  genres: string[];
  cast?: string[];
  voteAverage?: number;
  runtimeMinutes?: number;
  providers?: string[];
}

interface TmdbWatchProvidersAppend {
  results?: Record<string, { flatrate?: Array<{ provider_id: number; provider_name: string }> }>;
}

interface TmdbDetailResponseWithProviders extends TmdbDetailResponse {
  "watch/providers"?: TmdbWatchProvidersAppend;
}

async function fetchTmdbDetails(
  mediaType: "movie" | "tv" | "person" | undefined,
  id: number,
  watchRegion?: string
): Promise<TmdbDetailSummary | null> {
  if (mediaType !== "movie" && mediaType !== "tv") return null;
  const cacheKey = `${mediaType}:${id}:${watchRegion ?? "none"}`;
  const cached = detailCache.get(cacheKey);
  if (cached) return cached;

  const task = (async () => {
    const append = watchRegion ? "credits,watch/providers" : "credits";
    const response = await fetch(`${API_BASE}/${mediaType}/${id}?append_to_response=${append}`, {
      headers: {
        accept: "application/json"
      }
    });

    if (!response.ok) return null;

    const data = (await response.json()) as TmdbDetailResponseWithProviders;
    const genres = (data.genres ?? []).map((genre) => genre.name).filter(Boolean);
    const cast = (data.credits?.cast ?? [])
      .map((entry) => entry.name?.trim())
      .filter((name): name is string => Boolean(name))
      .slice(0, 5);

    const runtimeMinutes = mediaType === "movie"
      ? data.runtime
      : data.episode_run_time?.length
        ? data.episode_run_time[0]
        : undefined;

    let providers: string[] | undefined;
    if (watchRegion) {
      const region = tmdbWatchRegion(watchRegion);
      const bucket = data["watch/providers"]?.results?.[region];
      if (bucket?.flatrate?.length) {
        providers = mapTmdbProvidersToCanonical(bucket.flatrate);
      }
    }

    return {
      overview: data.overview,
      posterPath: data.poster_path ?? null,
      genres,
      cast: cast.length ? cast : undefined,
      voteAverage: data.vote_average,
      runtimeMinutes,
      providers
    };
  })();

  setWithLimit(detailCache, cacheKey, task, DETAIL_CACHE_MAX_ENTRIES);
  return task;
}

async function getGenreLookup(): Promise<Map<number, string>> {
  if (genreLookupPromise) return genreLookupPromise;

  genreLookupPromise = (async () => {
    const [movieRes, tvRes] = await Promise.all([
      fetch(`${API_BASE}/genre/movie/list`, {
        headers: { accept: "application/json" }
      }),
      fetch(`${API_BASE}/genre/tv/list`, {
        headers: { accept: "application/json" }
      })
    ]);

    const lookup = new Map<number, string>();
    if (movieRes.ok) {
      const movieData = (await movieRes.json()) as { genres?: Array<{ id: number; name: string }> };
      for (const genre of movieData.genres ?? []) {
        lookup.set(genre.id, genre.name);
      }
    }
    if (tvRes.ok) {
      const tvData = (await tvRes.json()) as { genres?: Array<{ id: number; name: string }> };
      for (const genre of tvData.genres ?? []) {
        lookup.set(genre.id, genre.name);
      }
    }
    return lookup;
  })();

  return genreLookupPromise;
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>
): Promise<R[]> {
  if (values.length === 0) return [];
  const size = Math.max(1, Math.min(concurrency, values.length));
  const out = new Array<R>(values.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < values.length) {
      const current = nextIndex;
      nextIndex += 1;
      out[current] = await mapper(values[current]!, current);
    }
  }

  await Promise.all(Array.from({ length: size }, () => worker()));
  return out;
}

function setWithLimit<K, V>(map: Map<K, V>, key: K, value: V, maxEntries: number): void {
  map.set(key, value);
  if (map.size <= maxEntries) return;
  const firstKey = map.keys().next().value as K | undefined;
  if (firstKey !== undefined) {
    map.delete(firstKey);
  }
}
