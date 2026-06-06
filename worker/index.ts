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
}

const OPENAI_PATH = "/api/openai/chat/completions";
const TMDB_PREFIX = "/api/tmdb";
const MAX_OPENAI_MAX_TOKENS = 1_200;
const MAX_OPENAI_MESSAGES = 40;
const MAX_OPENAI_REQUEST_BYTES = 50_000;

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

function dailyRateLimiterStub(namespace: DurableObjectNamespace, ip: string) {
  const day = new Date().toISOString().slice(0, 10);
  const id = namespace.idFromName(`ai:${ip}:${day}`);
  return namespace.get(id);
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
