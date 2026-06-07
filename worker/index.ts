/// <reference types="@cloudflare/workers-types/2023-07-01" />

import {
  checkAndIncrementDailyLimit,
  clientIp,
  parseAiDailyLimit,
  readDailyLimitStatus,
  turnstileTokenFromRequest,
  verifyTurnstile
} from "./security";

export interface Env {
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  AI_MODELS?: string;
  TMDB_READ_ACCESS_TOKEN?: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_SITE_KEY?: string;
  AI_DAILY_LIMIT?: string;
  RATE_KV?: KVNamespace;
  RATE_LIMITER?: DurableObjectNamespace;
  ROOMS?: DurableObjectNamespace;
}

const OPENAI_PATH = "/api/openai/chat/completions";
const TMDB_PREFIX = "/api/tmdb";
const MAX_OPENAI_MAX_TOKENS = 1_200;
const MAX_OPENAI_MESSAGES = 40;
const MAX_OPENAI_REQUEST_BYTES = 50_000;
const GROUP_ROOM_SIZE = 2;
const GROUP_DECK_SIZE = 10;

type TitleType = "movie" | "series";

interface GroupRoomAnswers {
  moods: string[];
  preferredType: TitleType | "either";
  runtime: "short" | "standard" | "long" | "any";
  languages: string[];
  releaseWindow: "any" | "2020s" | "2010s" | "2000s" | "pre-2000";
  customYearRange: { min: number; max: number } | null;
  familiarities: Array<"popular" | "hidden-gems" | "for-kids" | "adults-only" | "acclaimed">;
  providers: string[];
  hardExclusions: string[];
  keywords: string[];
}

interface GroupRoomTitle {
  id: string;
  name: string;
  type: TitleType;
  runtimeMinutes: number;
  genres: string[];
  moods: string[];
  language: string;
  providers: string[];
  popularity: number;
  releaseYear: number;
  posterPath?: string | null;
  overview: string;
  rating?: number;
  cast?: string[];
}

interface OpenAiSuggestion {
  name: string;
  type: TitleType;
}

function json(data: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  const headers = new Headers({ "content-type": "application/json" });
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) headers.set(k, v);
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function openAiBaseUrl(env: Env): string {
  const raw = (env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  return raw;
}

function parseAllowedModels(env: Env): string[] {
  return (env.AI_MODELS ?? "gpt-4.1-mini")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
}

function sanitizeOpenAiPayload(
  body: unknown,
  allowedModels: string[]
): { value: Record<string, unknown> } | { error: string; status: number } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Invalid JSON body", status: 400 };
  }
  const payload = { ...(body as Record<string, unknown>) };
  const model = payload.model;
  if (typeof model !== "string" || !allowedModels.includes(model)) {
    return { error: "Model is not allowed", status: 400 };
  }
  const messages = payload.messages;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_OPENAI_MESSAGES) {
    return { error: "Invalid messages payload", status: 400 };
  }
  const maxTokens = payload.max_tokens;
  if (typeof maxTokens === "number") {
    payload.max_tokens = Math.min(Math.floor(maxTokens), MAX_OPENAI_MAX_TOKENS);
  }
  return { value: payload };
}

function isAllowedTmdbPath(rest: string): boolean {
  if (rest === "/3/search/multi") return true;
  if (rest === "/3/genre/movie/list" || rest === "/3/genre/tv/list") return true;
  if (/^\/3\/(movie|tv)\/\d+$/.test(rest)) return true;
  if (/^\/3\/(movie|tv)\/\d+\/watch\/providers$/.test(rest)) return true;
  return false;
}

interface DoRateResponse {
  allowed: boolean;
  count: number;
  limit: number;
}

interface GroupRoomParticipant {
  participantId: string;
  joinedAt: string;
  lastSeenAt?: string;
  completedAt?: string;
  shortlist: string[];
  finalPickId?: string;
  compromiseRequestedAt?: string;
  compromisePickId?: string;
}

interface GroupRoomSnapshot {
  roomCode: string;
  createdAt: string;
  hostParticipantId: string;
  deck: GroupRoomTitle[];
  participants: GroupRoomParticipant[];
  maxParticipants: number;
  revealedAt?: string;
  matches?: string[];
}

interface GroupParticipantPick {
  participantId: string;
  titleId?: string;
}

interface GroupParticipantCompromiseRequest {
  participantId: string;
  requested: boolean;
}

interface SharedCompromiseResolution {
  sharedCompromiseId?: string;
  compromiseMatched: boolean;
}

function dailyRateLimiterStub(namespace: DurableObjectNamespace, ip: string) {
  const day = new Date().toISOString().slice(0, 10);
  const id = namespace.idFromName(`ai:${ip}:${day}`);
  return namespace.get(id);
}

function groupRoomStub(namespace: DurableObjectNamespace, roomCode: string) {
  const id = namespace.idFromName(`room:${roomCode}`);
  return namespace.get(id);
}

function randomCodeToken(length = 3): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}

function createRoomCode(): string {
  return `MOVIE-${randomCodeToken(3)}`;
}

async function readDailyLimitStatusViaDo(
  namespace: DurableObjectNamespace,
  ip: string,
  limit: number
): Promise<DoRateResponse> {
  const stub = dailyRateLimiterStub(namespace, ip);
  const response = await stub.fetch(`https://internal/rate/status?limit=${limit}`);
  if (!response.ok) {
    throw new Error(`Rate limiter DO failed: HTTP ${response.status}`);
  }
  return (await response.json()) as DoRateResponse;
}

async function checkAndIncrementDailyLimitViaDo(
  namespace: DurableObjectNamespace,
  ip: string,
  limit: number
): Promise<DoRateResponse> {
  const stub = dailyRateLimiterStub(namespace, ip);
  const response = await stub.fetch("https://internal/rate/increment", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ limit })
  });
  if (!response.ok) {
    throw new Error(`Rate limiter DO failed: HTTP ${response.status}`);
  }
  return (await response.json()) as DoRateResponse;
}

async function aiQuotaPayload(env: Env, ip: string) {
  const limit = parseAiDailyLimit(env.AI_DAILY_LIMIT);
  if (!env.RATE_LIMITER && !env.RATE_KV) {
    return { count: 0, limit, remaining: limit, limited: false };
  }

  const rate = env.RATE_LIMITER
    ? await readDailyLimitStatusViaDo(env.RATE_LIMITER, ip, limit)
    : await readDailyLimitStatus(env.RATE_KV!, ip, limit);
  const remaining = Math.max(0, rate.limit - rate.count);
  return { count: rate.count, limit: rate.limit, remaining, limited: true };
}

async function gateOpenAiRequest(request: Request, env: Env): Promise<Response | null> {
  const ip = clientIp(request);
  const limit = parseAiDailyLimit(env.AI_DAILY_LIMIT);

  if (env.TURNSTILE_SECRET_KEY) {
    const token = turnstileTokenFromRequest(request);
    const ok = await verifyTurnstile(token, env.TURNSTILE_SECRET_KEY, ip);
    if (!ok) {
      return json({ error: "Turnstile verification failed" }, 403);
    }
  }

  if (env.RATE_LIMITER || env.RATE_KV) {
    const rate = env.RATE_LIMITER
      ? await checkAndIncrementDailyLimitViaDo(env.RATE_LIMITER, ip, limit)
      : await checkAndIncrementDailyLimit(env.RATE_KV!, ip, limit);
    if (!rate.allowed) {
      return json(
        {
          error: "Daily AI limit reached",
          limit: rate.limit,
          count: rate.count
        },
        429,
        { "Retry-After": "86400" }
      );
    }
  }

  return null;
}

function normalizeGroupRoomAnswers(raw: unknown): GroupRoomAnswers | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  const preferredType = input.preferredType;
  const runtime = input.runtime;
  const releaseWindow = input.releaseWindow;
  return {
    moods: normalizeStringList(input.moods),
    preferredType:
      preferredType === "movie" || preferredType === "series" || preferredType === "either"
        ? preferredType
        : "either",
    runtime:
      runtime === "short" || runtime === "standard" || runtime === "long" || runtime === "any"
        ? runtime
        : "any",
    languages: normalizeStringList(input.languages),
    releaseWindow:
      releaseWindow === "2020s" ||
      releaseWindow === "2010s" ||
      releaseWindow === "2000s" ||
      releaseWindow === "pre-2000" ||
      releaseWindow === "any"
        ? releaseWindow
        : "any",
    customYearRange: normalizeYearRange(input.customYearRange),
    familiarities: normalizeStringList(input.familiarities) as GroupRoomAnswers["familiarities"],
    providers: normalizeStringList(input.providers),
    hardExclusions: normalizeStringList(input.hardExclusions),
    keywords: normalizeStringList(input.keywords)
  };
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const list = value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
  return Array.from(new Set(list));
}

function normalizeYearRange(value: unknown): { min: number; max: number } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const min = Number(input.min);
  const max = Number(input.max);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { min: Math.floor(min), max: Math.floor(max) };
}

function buildGeneratePromptForRoom(answers: GroupRoomAnswers, watchRegion: string): string {
  return JSON.stringify({
    task: "Suggest highly watchable titles for a two-person movie night deck.",
    constraints: [
      `Return up to ${GROUP_DECK_SIZE} suggestions.`,
      "Use real titles that exist in TMDB.",
      "No duplicates.",
      "Prefer titles available in the specified watch region."
    ],
    watchRegion,
    answers,
    outputShape: {
      suggestions: [{ name: "string", type: "movie|series" }]
    }
  });
}

async function buildGroupRoomDeck(env: Env, answers: GroupRoomAnswers, watchRegion: string): Promise<GroupRoomTitle[]> {
  const suggestions = await generateAiSuggestionsForRoom(env, answers, watchRegion);
  const fromAi = await resolveSuggestionsToTitles(env, suggestions, watchRegion, answers.moods);
  const deduped = dedupeTitles(fromAi);
  if (deduped.length >= GROUP_DECK_SIZE) return deduped.slice(0, GROUP_DECK_SIZE);

  const fallback = await fetchFallbackTitles(env, watchRegion, answers.moods);
  return dedupeTitles([...deduped, ...fallback]).slice(0, GROUP_DECK_SIZE);
}

async function generateAiSuggestionsForRoom(
  env: Env,
  answers: GroupRoomAnswers,
  watchRegion: string
): Promise<OpenAiSuggestion[]> {
  if (!env.OPENAI_API_KEY) return [];
  const model = parseAllowedModels(env)[0];
  if (!model) return [];
  try {
    const response = await fetch(`${openAiBaseUrl(env)}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'Return strict JSON in the shape {"suggestions":[{"name":"","type":"movie|series"}]}.'
          },
          {
            role: "user",
            content: buildGeneratePromptForRoom(answers, watchRegion)
          }
        ]
      })
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    const text =
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content
              .filter((part) => part?.type === "text" && typeof part.text === "string")
              .map((part) => part.text ?? "")
              .join("\n")
          : "";
    if (!text) return [];
    const parsed = JSON.parse(text) as { suggestions?: Array<{ name?: unknown; type?: unknown }> };
    if (!Array.isArray(parsed.suggestions)) return [];
    const seen = new Set<string>();
    const out: OpenAiSuggestion[] = [];
    for (const item of parsed.suggestions) {
      const name = typeof item.name === "string" ? item.name.trim() : "";
      const type = item.type === "movie" || item.type === "series" ? item.type : null;
      if (!name || !type) continue;
      const key = `${name.toLowerCase()}::${type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ name, type });
      if (out.length >= GROUP_DECK_SIZE) break;
    }
    return out;
  } catch {
    return [];
  }
}

async function resolveSuggestionsToTitles(
  env: Env,
  suggestions: OpenAiSuggestion[],
  watchRegion: string,
  moods: string[]
): Promise<GroupRoomTitle[]> {
  const out: GroupRoomTitle[] = [];
  for (const suggestion of suggestions) {
    const title = await resolveSuggestionToTitle(env, suggestion, watchRegion, moods);
    if (title) out.push(title);
  }
  return out;
}

async function resolveSuggestionToTitle(
  env: Env,
  suggestion: OpenAiSuggestion,
  watchRegion: string,
  moods: string[]
): Promise<GroupRoomTitle | null> {
  const token = env.TMDB_READ_ACCESS_TOKEN;
  if (!token) return null;
  const search = new URL("https://api.themoviedb.org/3/search/multi");
  search.searchParams.set("query", suggestion.name);
  search.searchParams.set("include_adult", "false");
  search.searchParams.set("language", "en-US");
  const searchData = await tmdbFetchJson<{ results?: Array<Record<string, unknown>> }>(token, search);
  const mediaType = suggestion.type === "movie" ? "movie" : "tv";
  const match = (searchData.results ?? []).find((item) => {
    if ((item.media_type as string) !== mediaType) return false;
    if (typeof item.id !== "number") return false;
    return true;
  });
  if (!match || typeof match.id !== "number") return null;
  return fetchTmdbTitleDetails(token, mediaType, match.id, watchRegion, moods);
}

async function fetchFallbackTitles(env: Env, watchRegion: string, moods: string[]): Promise<GroupRoomTitle[]> {
  const token = env.TMDB_READ_ACCESS_TOKEN;
  if (!token) return [];
  const urls = [
    "https://api.themoviedb.org/3/discover/movie?sort_by=popularity.desc&include_adult=false&language=en-US&page=1",
    "https://api.themoviedb.org/3/discover/tv?sort_by=popularity.desc&include_adult=false&language=en-US&page=1"
  ];
  const out: GroupRoomTitle[] = [];
  for (const rawUrl of urls) {
    const data = await tmdbFetchJson<{ results?: Array<Record<string, unknown>> }>(token, new URL(rawUrl));
    for (const item of data.results ?? []) {
      if (typeof item.id !== "number") continue;
      const mediaType = rawUrl.includes("/movie") ? "movie" : "tv";
      const detail = await fetchTmdbTitleDetails(token, mediaType, item.id, watchRegion, moods);
      if (detail) out.push(detail);
      if (out.length >= GROUP_DECK_SIZE) return out;
    }
  }
  return out;
}

async function fetchTmdbTitleDetails(
  token: string,
  mediaType: "movie" | "tv",
  id: number,
  watchRegion: string,
  moods: string[]
): Promise<GroupRoomTitle | null> {
  const detailsUrl = new URL(`https://api.themoviedb.org/3/${mediaType}/${id}`);
  detailsUrl.searchParams.set("append_to_response", "watch/providers,credits");
  detailsUrl.searchParams.set("language", "en-US");
  const details = await tmdbFetchJson<Record<string, unknown>>(token, detailsUrl);
  const nameKey = mediaType === "movie" ? "title" : "name";
  const rawName = details[nameKey];
  if (typeof rawName !== "string" || !rawName.trim()) return null;
  const genres = Array.isArray(details.genres)
    ? details.genres
        .map((genre) => (typeof genre === "object" && genre && typeof (genre as { name?: unknown }).name === "string" ? (genre as { name: string }).name : null))
        .filter((name): name is string => Boolean(name))
    : [];
  const runtimeMinutes =
    mediaType === "movie"
      ? numberOr(details.runtime, 100)
      : Array.isArray(details.episode_run_time) && typeof details.episode_run_time[0] === "number"
        ? Math.floor(details.episode_run_time[0])
        : 45;
  const releaseDate = mediaType === "movie" ? details.release_date : details.first_air_date;
  const releaseYear = typeof releaseDate === "string" && releaseDate.length >= 4 ? Number(releaseDate.slice(0, 4)) : 0;
  const providers = extractProviders(details, watchRegion);
  const cast = Array.isArray((details.credits as { cast?: unknown[] } | undefined)?.cast)
    ? ((details.credits as { cast: Array<{ name?: unknown }> }).cast
        .map((item) => (typeof item?.name === "string" ? item.name : null))
        .filter((name): name is string => Boolean(name))
        .slice(0, 6))
    : [];

  return {
    id: `tmdb:${mediaType}:${id}`,
    name: rawName.trim(),
    type: mediaType === "movie" ? "movie" : "series",
    runtimeMinutes,
    genres,
    moods,
    language: typeof details.original_language === "string" ? details.original_language : "en",
    providers,
    popularity: numberOr(details.popularity, 0),
    releaseYear: Number.isFinite(releaseYear) ? releaseYear : 0,
    posterPath: typeof details.poster_path === "string" ? details.poster_path : null,
    overview: typeof details.overview === "string" ? details.overview : "",
    rating: numberOr(details.vote_average, 0),
    cast
  };
}

function extractProviders(details: Record<string, unknown>, watchRegion: string): string[] {
  const root = details["watch/providers"] as { results?: Record<string, { flatrate?: Array<{ provider_name?: string }> }> } | undefined;
  const list = root?.results?.[watchRegion]?.flatrate ?? [];
  return list
    .map((item) => (typeof item.provider_name === "string" ? item.provider_name : null))
    .filter((provider): provider is string => Boolean(provider));
}

async function tmdbFetchJson<T>(token: string, target: URL): Promise<T> {
  const response = await fetch(target, {
    headers: {
      Authorization: `Bearer ${token}`,
      accept: "application/json"
    }
  });
  if (!response.ok) {
    throw new Error(`TMDB request failed with HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

function dedupeTitles(input: GroupRoomTitle[]): GroupRoomTitle[] {
  const seen = new Set<string>();
  const out: GroupRoomTitle[] = [];
  for (const title of input) {
    if (seen.has(title.id)) continue;
    seen.add(title.id);
    out.push(title);
  }
  return out;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function computeOverlapTitleIds(
  participants: GroupRoomParticipant[],
  deck: GroupRoomTitle[],
  maxParticipants: number
): string[] {
  if (participants.length < maxParticipants) return [];
  const [first, ...rest] = participants;
  const overlap = Array.from(new Set(first?.shortlist ?? [])).filter((id) =>
    rest.every((participant) => participant.shortlist.includes(id))
  );
  const deckOrder = new Map(deck.map((title, index) => [title.id, index]));
  return overlap.sort((a, b) => {
    const ai = deckOrder.get(a) ?? Number.MAX_SAFE_INTEGER;
    const bi = deckOrder.get(b) ?? Number.MAX_SAFE_INTEGER;
    if (ai !== bi) return ai - bi;
    return a.localeCompare(b);
  });
}

function resolveSharedCompromise(
  participants: GroupRoomParticipant[],
  deck: GroupRoomTitle[],
  overlapTitleIds: string[],
  maxParticipants: number
): SharedCompromiseResolution {
  const picks = participants.map((participant) => participant.compromisePickId).filter((value): value is string => Boolean(value));
  if (picks.length === 0) return { sharedCompromiseId: undefined, compromiseMatched: false };
  if (picks.length < maxParticipants) return { sharedCompromiseId: undefined, compromiseMatched: false };
  if (picks[0] === picks[1]) return { sharedCompromiseId: picks[0], compromiseMatched: true };

  const candidates = [picks[0], picks[1]];
  const deckOrder = new Map(deck.map((title, index) => [title.id, index]));
  const overlapSet = new Set(overlapTitleIds);
  const shortlistRanks = participants.map((participant) => {
    const map = new Map<string, number>();
    participant.shortlist.forEach((id, index) => map.set(id, index));
    return map;
  });

  candidates.sort((left, right) => {
    const leftScore = shortlistRanks.reduce((score, ranks) => score + (ranks.get(left) ?? 1_000_000), 0);
    const rightScore = shortlistRanks.reduce((score, ranks) => score + (ranks.get(right) ?? 1_000_000), 0);
    if (leftScore !== rightScore) return leftScore - rightScore;
    const leftDeck = deckOrder.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightDeck = deckOrder.get(right) ?? Number.MAX_SAFE_INTEGER;
    if (leftDeck !== rightDeck) return leftDeck - rightDeck;
    return left.localeCompare(right);
  });

  const resolved = candidates.find((candidate) => overlapSet.has(candidate)) ?? candidates[0];
  return { sharedCompromiseId: resolved, compromiseMatched: false };
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/viewer-region" && request.method === "GET") {
      const cf = request.cf as { country?: string } | undefined;
      const country = cf?.country ?? request.headers.get("CF-IPCountry");
      const normalized = country?.trim().toUpperCase();
      return json({
        country: normalized && normalized.length === 2 ? normalized : null
      });
    }

    if (url.pathname === "/api/config" && request.method === "GET") {
      const openaiModels = parseAllowedModels(env);
      const aiDailyLimit = parseAiDailyLimit(env.AI_DAILY_LIMIT);
      return json({
        ai: Boolean(env.OPENAI_API_KEY),
        tmdb: Boolean(env.TMDB_READ_ACCESS_TOKEN),
        openaiModels,
        turnstileSiteKey: env.TURNSTILE_SITE_KEY ?? null,
        aiDailyLimit,
        turnstileRequired: Boolean(env.TURNSTILE_SECRET_KEY)
      });
    }

    if (url.pathname === "/api/ai-quota" && request.method === "GET") {
      if (!env.OPENAI_API_KEY) {
        return json({ error: "OpenAI is not configured" }, 503);
      }
      return json(await aiQuotaPayload(env, clientIp(request)));
    }

    if (url.pathname === "/api/group/rooms" && request.method === "POST") {
      if (!env.ROOMS) {
        return json({ error: "Rooms are not configured" }, 503);
      }
      const payload = (await request.json().catch(() => null)) as {
        answers?: unknown;
        watchRegion?: unknown;
      } | null;
      const answers = normalizeGroupRoomAnswers(payload?.answers);
      const watchRegion =
        typeof payload?.watchRegion === "string" && /^[A-Za-z]{2}$/.test(payload.watchRegion)
          ? payload.watchRegion.toUpperCase()
          : null;
      if (!answers || !watchRegion) {
        return json({ error: "answers and watchRegion are required" }, 400);
      }

      let deck: GroupRoomTitle[] = [];
      try {
        deck = await buildGroupRoomDeck(env, answers, watchRegion);
      } catch (error) {
        console.error("group room deck build failed", error);
      }

      if (deck.length === 0) {
        return json({ error: "Could not build a room deck right now" }, 502);
      }

      const roomCode = createRoomCode();
      const hostParticipantId = crypto.randomUUID();
      const stub = groupRoomStub(env.ROOMS, roomCode);
      const created = await stub.fetch("https://internal/group/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roomCode,
          hostParticipantId,
          deck
        })
      });
      if (!created.ok) {
        return json({ error: "Could not create room" }, created.status);
      }

      const origin = `${url.protocol}//${url.host}`;
      return json({
        roomCode,
        participantId: hostParticipantId,
        shareUrl: `${origin}/?room=${encodeURIComponent(roomCode)}`,
        deck
      });
    }

    const groupPathMatch = url.pathname.match(
      /^\/api\/group\/rooms\/([^/]+)(?:\/(join|submit|status|reveal|final-pick|compromise-pick|compromise-start))?$/
    );
    if (groupPathMatch) {
      if (!env.ROOMS) {
        return json({ error: "Rooms are not configured" }, 503);
      }
      const roomCode = decodeURIComponent(groupPathMatch[1] ?? "").trim().toUpperCase();
      if (!roomCode) {
        return json({ error: "Room code is required" }, 400);
      }
      const action = groupPathMatch[2];
      const stub = groupRoomStub(env.ROOMS, roomCode);

      if (action === "join" && request.method === "POST") {
        const payload = (await request.json().catch(() => null)) as { participantId?: unknown } | null;
        const participantId =
          typeof payload?.participantId === "string" && payload.participantId.trim()
            ? payload.participantId.trim()
            : crypto.randomUUID();
        const response = await stub.fetch("https://internal/group/join", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ participantId })
        });
        if (!response.ok) {
          const text = await response.text();
          return json({ error: text || "Could not join room" }, response.status);
        }
        const roomPayload = (await response.json()) as Record<string, unknown>;
        return json({
          participantId,
          ...roomPayload
        });
      }

      if (action === "submit" && request.method === "POST") {
        const payload = (await request.json().catch(() => null)) as {
          participantId?: unknown;
          shortlist?: unknown;
        } | null;
        if (typeof payload?.participantId !== "string" || !Array.isArray(payload?.shortlist)) {
          return json({ error: "participantId and shortlist are required" }, 400);
        }
        const response = await stub.fetch("https://internal/group/submit", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!response.ok) {
          const text = await response.text();
          return json({ error: text || "Could not submit shortlist" }, response.status);
        }
        return json(await response.json());
      }

      if (action === "status" && request.method === "GET") {
        const response = await stub.fetch("https://internal/group/status", { method: "GET" });
        if (!response.ok) {
          const text = await response.text();
          return json({ error: text || "Could not load room status" }, response.status);
        }
        return json(await response.json());
      }

      if (action === "reveal" && request.method === "POST") {
        const payload = (await request.json().catch(() => null)) as { participantId?: unknown } | null;
        if (typeof payload?.participantId !== "string") {
          return json({ error: "participantId is required" }, 400);
        }
        const response = await stub.fetch("https://internal/group/reveal", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!response.ok) {
          const text = await response.text();
          return json({ error: text || "Could not reveal room results" }, response.status);
        }
        return json(await response.json());
      }

      if (action === "final-pick" && request.method === "POST") {
        const payload = (await request.json().catch(() => null)) as {
          participantId?: unknown;
          winnerId?: unknown;
        } | null;
        if (typeof payload?.participantId !== "string" || typeof payload?.winnerId !== "string") {
          return json({ error: "participantId and winnerId are required" }, 400);
        }
        const response = await stub.fetch("https://internal/group/final-pick", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!response.ok) {
          const text = await response.text();
          return json({ error: text || "Could not submit final pick" }, response.status);
        }
        return json(await response.json());
      }

      if (action === "compromise-pick" && request.method === "POST") {
        const payload = (await request.json().catch(() => null)) as {
          participantId?: unknown;
          winnerId?: unknown;
        } | null;
        if (typeof payload?.participantId !== "string" || typeof payload?.winnerId !== "string") {
          return json({ error: "participantId and winnerId are required" }, 400);
        }
        const response = await stub.fetch("https://internal/group/compromise-pick", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!response.ok) {
          const text = await response.text();
          return json({ error: text || "Could not submit compromise pick" }, response.status);
        }
        return json(await response.json());
      }

      if (action === "compromise-start" && request.method === "POST") {
        const payload = (await request.json().catch(() => null)) as {
          participantId?: unknown;
        } | null;
        if (typeof payload?.participantId !== "string") {
          return json({ error: "participantId is required" }, 400);
        }
        const response = await stub.fetch("https://internal/group/compromise-start", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!response.ok) {
          const text = await response.text();
          return json({ error: text || "Could not start compromise showdown" }, response.status);
        }
        return json(await response.json());
      }
    }

    if (url.pathname === OPENAI_PATH && request.method === "POST") {
      const key = env.OPENAI_API_KEY;
      if (!key) return json({ error: "OpenAI is not configured" }, 503);

      const gate = await gateOpenAiRequest(request, env);
      if (gate) return gate;

      const contentLength = Number(request.headers.get("content-length") ?? "0");
      if (Number.isFinite(contentLength) && contentLength > MAX_OPENAI_REQUEST_BYTES) {
        return json({ error: "Request body too large" }, 413);
      }

      let parsedBody: unknown;
      try {
        parsedBody = await request.json();
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }

      const sanitized = sanitizeOpenAiPayload(parsedBody, parseAllowedModels(env));
      if ("error" in sanitized) {
        return json({ error: sanitized.error }, sanitized.status);
      }

      const upstreamUrl = `${openAiBaseUrl(env)}/chat/completions`;
      try {
        const upstream = await fetch(upstreamUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(sanitized.value)
        });

        const headers = new Headers();
        const resCt = upstream.headers.get("content-type");
        if (resCt) headers.set("content-type", resCt);
        return new Response(upstream.body, { status: upstream.status, headers });
      } catch (error) {
        console.error("openai upstream request failed", error);
        return json({ error: "Upstream OpenAI request failed" }, 502);
      }
    }

    if (url.pathname.startsWith(`${TMDB_PREFIX}/`) && request.method === "GET") {
      const token = env.TMDB_READ_ACCESS_TOKEN;
      if (!token) return json({ error: "TMDB is not configured" }, 503);

      const rest = url.pathname.slice(TMDB_PREFIX.length);
      if (!isAllowedTmdbPath(rest)) {
        return json({ error: "TMDB path is not allowed" }, 400);
      }
      const target = new URL(`https://api.themoviedb.org${rest}${url.search}`);

      try {
        return await fetch(target, {
          headers: {
            Authorization: `Bearer ${token}`,
            accept: "application/json"
          }
        });
      } catch (error) {
        console.error("tmdb upstream request failed", error);
        return json({ error: "Upstream TMDB request failed" }, 502);
      }
    }

    if (url.pathname.startsWith("/api/")) {
      return new Response(null, { status: 404 });
    }

    return new Response(null, { status: 404 });
  }
} satisfies ExportedHandler<Env>;

function parseDailyRateLimitFromQuery(url: URL): number {
  const fromQuery = Number(url.searchParams.get("limit"));
  if (Number.isFinite(fromQuery) && fromQuery >= 1) return Math.floor(fromQuery);
  return NaN;
}

async function parseDailyRateLimitFromBody(request: Request): Promise<number> {
  const payload = (await request.json().catch(() => null)) as { limit?: unknown } | null;
  const limit = typeof payload?.limit === "number" ? Math.floor(payload.limit) : NaN;
  return Number.isFinite(limit) && limit >= 1 ? limit : NaN;
}

export class DailyRateLimiter implements DurableObject {
  private static readonly CLEANUP_DELAY_MS = 26 * 60 * 60 * 1000;

  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const current = ((await this.state.storage.get<number>("count")) ?? 0) as number;

    if (url.pathname.endsWith("/rate/status")) {
      if (request.method !== "GET") {
        return new Response("Method not allowed", { status: 405 });
      }
      const limit = parseDailyRateLimitFromQuery(url);
      if (!Number.isFinite(limit)) {
        return new Response(JSON.stringify({ error: "Invalid limit" }), {
          status: 400,
          headers: { "content-type": "application/json" }
        });
      }
      await this.ensureCleanupAlarm();
      return new Response(
        JSON.stringify({ allowed: current < limit, count: current, limit }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    if (url.pathname.endsWith("/rate/increment")) {
      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }
      const limit = await parseDailyRateLimitFromBody(request);
      if (!Number.isFinite(limit)) {
        return new Response(JSON.stringify({ error: "Invalid limit" }), {
          status: 400,
          headers: { "content-type": "application/json" }
        });
      }
      if (current >= limit) {
        await this.ensureCleanupAlarm();
        return new Response(JSON.stringify({ allowed: false, count: current, limit }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      const next = current + 1;
      await this.state.storage.put("count", next);
      await this.ensureCleanupAlarm();
      return new Response(JSON.stringify({ allowed: true, count: next, limit }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }

    return new Response("Not found", { status: 404 });
  }

  async alarm(): Promise<void> {
    await this.state.storage.deleteAll();
  }

  private async ensureCleanupAlarm(): Promise<void> {
    const existing = await this.state.storage.getAlarm();
    if (existing === null) {
      await this.state.storage.setAlarm(Date.now() + DailyRateLimiter.CLEANUP_DELAY_MS);
    }
  }
}

export class GroupRoomCoordinator implements DurableObject {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.endsWith("/group/create")) {
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
      const payload = (await request.json().catch(() => null)) as {
        roomCode?: unknown;
        hostParticipantId?: unknown;
        deck?: unknown;
      } | null;
      if (
        typeof payload?.roomCode !== "string" ||
        typeof payload?.hostParticipantId !== "string" ||
        !Array.isArray(payload?.deck) ||
        payload.deck.length === 0
      ) {
        return new Response("Invalid room payload", { status: 400 });
      }
      const snapshot: GroupRoomSnapshot = {
        roomCode: payload.roomCode,
        createdAt: new Date().toISOString(),
        hostParticipantId: payload.hostParticipantId,
        deck: payload.deck,
        maxParticipants: GROUP_ROOM_SIZE,
        participants: [
          {
            participantId: payload.hostParticipantId,
            joinedAt: new Date().toISOString(),
            lastSeenAt: new Date().toISOString(),
            shortlist: []
          }
        ]
      };
      await this.state.storage.put("room", snapshot);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }

    if (url.pathname.endsWith("/group/join")) {
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
      const payload = (await request.json().catch(() => null)) as { participantId?: unknown } | null;
      if (typeof payload?.participantId !== "string") {
        return new Response("participantId is required", { status: 400 });
      }
      const room = await this.state.storage.get<GroupRoomSnapshot>("room");
      if (!room) return new Response("Room not found", { status: 404 });
      const maxParticipants = Number.isFinite(room.maxParticipants) ? room.maxParticipants : GROUP_ROOM_SIZE;
      room.maxParticipants = maxParticipants;
      const isExistingParticipant = room.participants.some((participant) => participant.participantId === payload.participantId);
      const activeParticipants = room.participants.slice(0, maxParticipants);
      if (!isExistingParticipant && activeParticipants.length >= maxParticipants) {
        return new Response("Room is full", { status: 409 });
      }
      if (!isExistingParticipant) {
        room.participants.push({
          participantId: payload.participantId,
          joinedAt: new Date().toISOString(),
          lastSeenAt: new Date().toISOString(),
          shortlist: []
        });
        await this.state.storage.put("room", room);
      }
      return new Response(
        JSON.stringify({
          roomCode: room.roomCode,
          deck: room.deck
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      );
    }

    if (url.pathname.endsWith("/group/submit")) {
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
      const payload = (await request.json().catch(() => null)) as {
        participantId?: unknown;
        shortlist?: unknown;
      } | null;
      if (typeof payload?.participantId !== "string" || !Array.isArray(payload?.shortlist)) {
        return new Response("participantId and shortlist are required", { status: 400 });
      }
      const room = await this.state.storage.get<GroupRoomSnapshot>("room");
      if (!room) return new Response("Room not found", { status: 404 });
      const maxParticipants = Number.isFinite(room.maxParticipants) ? room.maxParticipants : GROUP_ROOM_SIZE;
      room.maxParticipants = maxParticipants;
      const participant = room.participants
        .slice(0, maxParticipants)
        .find((entry) => entry.participantId === payload.participantId);
      if (!participant) return new Response("Participant not found", { status: 404 });
      participant.shortlist = payload.shortlist.filter((item): item is string => typeof item === "string");
      participant.completedAt = new Date().toISOString();
      await this.state.storage.put("room", room);
      return new Response(
        JSON.stringify({
          participantsReady: room.participants.filter((entry) => Boolean(entry.completedAt)).length,
          participantsTotal: room.participants.length
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      );
    }

    if (url.pathname.endsWith("/group/status")) {
      if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
      const room = await this.state.storage.get<GroupRoomSnapshot>("room");
      if (!room) return new Response("Room not found", { status: 404 });
      const maxParticipants = Number.isFinite(room.maxParticipants) ? room.maxParticipants : GROUP_ROOM_SIZE;
      room.maxParticipants = maxParticipants;
      const participants = room.participants.slice(0, maxParticipants);
      const participantId = url.searchParams.get("participantId");
      if (participantId) {
        const participant = participants.find((entry) => entry.participantId === participantId);
        if (participant) {
          participant.lastSeenAt = new Date().toISOString();
          await this.state.storage.put("room", room);
        }
      }
      const participantsReady = participants.filter((entry) => Boolean(entry.completedAt)).length;
      const participantsTotal = participants.length;
      const readyToReveal = participantsTotal === maxParticipants && participantsReady === participantsTotal;
      let overlapTitleIds = room.matches ?? [];
      if (readyToReveal) {
        overlapTitleIds = computeOverlapTitleIds(participants, room.deck, maxParticipants);
        if ((room.matches ?? []).join("|") !== overlapTitleIds.join("|")) {
          room.matches = overlapTitleIds;
          await this.state.storage.put("room", room);
        }
      }
      const participantFinalPicks: GroupParticipantPick[] = participants.map((participant) => ({
        participantId: participant.participantId,
        titleId: participant.finalPickId
      }));
      const participantCompromisePicks: GroupParticipantPick[] = participants.map((participant) => ({
        participantId: participant.participantId,
        titleId: participant.compromisePickId
      }));
      const participantCompromiseRequests: GroupParticipantCompromiseRequest[] = participants.map((participant) => ({
        participantId: participant.participantId,
        requested: Boolean(participant.compromiseRequestedAt)
      }));
      const compromise = resolveSharedCompromise(participants, room.deck, overlapTitleIds, maxParticipants);
      return new Response(
        JSON.stringify({
          roomCode: room.roomCode,
          participantsReady,
          participantsTotal,
          maxParticipants,
          readyToReveal,
          revealed: Boolean(room.revealedAt),
          overlapTitleIds,
          participantFinalPicks,
          participantCompromisePicks,
          participantCompromiseRequests,
          compromiseRequested: participantCompromiseRequests.some((entry) => entry.requested),
          sharedCompromiseId: compromise.sharedCompromiseId,
          compromiseMatched: compromise.compromiseMatched
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      );
    }

    if (url.pathname.endsWith("/group/reveal")) {
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
      const payload = (await request.json().catch(() => null)) as { participantId?: unknown } | null;
      if (typeof payload?.participantId !== "string") {
        return new Response("participantId is required", { status: 400 });
      }
      const room = await this.state.storage.get<GroupRoomSnapshot>("room");
      if (!room) return new Response("Room not found", { status: 404 });
      const maxParticipants = Number.isFinite(room.maxParticipants) ? room.maxParticipants : GROUP_ROOM_SIZE;
      room.maxParticipants = maxParticipants;
      const participants = room.participants.slice(0, maxParticipants);
      if (!participants.some((entry) => entry.participantId === payload.participantId)) {
        return new Response("Participant not found", { status: 404 });
      }

      const completed = participants.filter((entry) => Boolean(entry.completedAt));
      if (completed.length < maxParticipants) {
        return new Response("Everyone must finish swiping first", { status: 409 });
      }

      const [first, ...rest] = completed;
      const overlap = computeOverlapTitleIds([first, ...rest], room.deck, maxParticipants);
      room.matches = overlap;
      room.revealedAt = new Date().toISOString();
      await this.state.storage.put("room", room);
      return new Response(
        JSON.stringify({
          overlapTitleIds: overlap,
          roomCode: room.roomCode
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      );
    }

    if (url.pathname.endsWith("/group/final-pick")) {
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
      const payload = (await request.json().catch(() => null)) as {
        participantId?: unknown;
        winnerId?: unknown;
      } | null;
      if (typeof payload?.participantId !== "string" || typeof payload?.winnerId !== "string") {
        return new Response("participantId and winnerId are required", { status: 400 });
      }
      const room = await this.state.storage.get<GroupRoomSnapshot>("room");
      if (!room) return new Response("Room not found", { status: 404 });
      const maxParticipants = Number.isFinite(room.maxParticipants) ? room.maxParticipants : GROUP_ROOM_SIZE;
      room.maxParticipants = maxParticipants;
      const participants = room.participants.slice(0, maxParticipants);
      const participant = participants.find((entry) => entry.participantId === payload.participantId);
      if (!participant) return new Response("Participant not found", { status: 404 });
      const deckIds = new Set(room.deck.map((title) => title.id));
      if (!deckIds.has(payload.winnerId)) return new Response("winnerId is not in room deck", { status: 400 });
      participant.finalPickId = payload.winnerId;
      await this.state.storage.put("room", room);
      return new Response(
        JSON.stringify({
          participantFinalPicks: participants.map((entry) => ({
            participantId: entry.participantId,
            titleId: entry.finalPickId
          }))
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      );
    }

    if (url.pathname.endsWith("/group/compromise-pick")) {
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
      const payload = (await request.json().catch(() => null)) as {
        participantId?: unknown;
        winnerId?: unknown;
      } | null;
      if (typeof payload?.participantId !== "string" || typeof payload?.winnerId !== "string") {
        return new Response("participantId and winnerId are required", { status: 400 });
      }
      const room = await this.state.storage.get<GroupRoomSnapshot>("room");
      if (!room) return new Response("Room not found", { status: 404 });
      const maxParticipants = Number.isFinite(room.maxParticipants) ? room.maxParticipants : GROUP_ROOM_SIZE;
      room.maxParticipants = maxParticipants;
      const participants = room.participants.slice(0, maxParticipants);
      const participant = participants.find((entry) => entry.participantId === payload.participantId);
      if (!participant) return new Response("Participant not found", { status: 404 });
      const overlapTitleIds = computeOverlapTitleIds(participants, room.deck, maxParticipants);
      const overlapSet = new Set(overlapTitleIds);
      if (!overlapSet.has(payload.winnerId)) {
        return new Response("winnerId is not in overlap set", { status: 400 });
      }
      participant.compromiseRequestedAt = participant.compromiseRequestedAt ?? new Date().toISOString();
      participant.compromisePickId = payload.winnerId;
      await this.state.storage.put("room", room);
      const participantCompromiseRequests: GroupParticipantCompromiseRequest[] = participants.map((entry) => ({
        participantId: entry.participantId,
        requested: Boolean(entry.compromiseRequestedAt)
      }));
      const compromise = resolveSharedCompromise(participants, room.deck, overlapTitleIds, maxParticipants);
      const compromiseReady = participants.filter((entry) => Boolean(entry.compromisePickId)).length;
      return new Response(
        JSON.stringify({
          participantCompromisePicks: participants.map((entry) => ({
            participantId: entry.participantId,
            titleId: entry.compromisePickId
          })),
          participantCompromiseRequests,
          compromiseRequested: participantCompromiseRequests.some((entry) => entry.requested),
          compromiseReady,
          sharedCompromiseId: compromise.sharedCompromiseId,
          compromiseMatched: compromise.compromiseMatched
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      );
    }

    if (url.pathname.endsWith("/group/compromise-start")) {
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
      const payload = (await request.json().catch(() => null)) as {
        participantId?: unknown;
      } | null;
      if (typeof payload?.participantId !== "string") {
        return new Response("participantId is required", { status: 400 });
      }
      const room = await this.state.storage.get<GroupRoomSnapshot>("room");
      if (!room) return new Response("Room not found", { status: 404 });
      const maxParticipants = Number.isFinite(room.maxParticipants) ? room.maxParticipants : GROUP_ROOM_SIZE;
      room.maxParticipants = maxParticipants;
      const participants = room.participants.slice(0, maxParticipants);
      const participant = participants.find((entry) => entry.participantId === payload.participantId);
      if (!participant) return new Response("Participant not found", { status: 404 });
      const overlapTitleIds = computeOverlapTitleIds(participants, room.deck, maxParticipants);
      if (overlapTitleIds.length < 2) {
        return new Response("Need at least two overlap titles to start compromise showdown", { status: 409 });
      }
      participant.compromiseRequestedAt = participant.compromiseRequestedAt ?? new Date().toISOString();
      await this.state.storage.put("room", room);
      const participantCompromiseRequests: GroupParticipantCompromiseRequest[] = participants.map((entry) => ({
        participantId: entry.participantId,
        requested: Boolean(entry.compromiseRequestedAt)
      }));
      return new Response(
        JSON.stringify({
          participantCompromiseRequests,
          compromiseRequested: participantCompromiseRequests.some((entry) => entry.requested)
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      );
    }

    return new Response("Not found", { status: 404 });
  }
}
