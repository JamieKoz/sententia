/// <reference types="@cloudflare/workers-types/2023-07-01" />

import {
  checkAndIncrementDailyLimit,
  clientIp,
  parseAiDailyLimit,
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
}

const OPENAI_PATH = "/api/openai/chat/completions";
const TMDB_PREFIX = "/api/tmdb";

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

  if (env.RATE_KV) {
    const rate = await checkAndIncrementDailyLimit(env.RATE_KV, ip, limit);
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
      const openaiModels = (env.AI_MODELS ?? "gpt-4.1-mini")
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);
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

    if (url.pathname === OPENAI_PATH && request.method === "POST") {
      const key = env.OPENAI_API_KEY;
      if (!key) return json({ error: "OpenAI is not configured" }, 503);

      const gate = await gateOpenAiRequest(request, env);
      if (gate) return gate;

      const upstreamUrl = `${openAiBaseUrl(env)}/chat/completions`;
      const contentType = request.headers.get("content-type") ?? "application/json";

      const upstream = await fetch(upstreamUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": contentType
        },
        body: request.body
      });

      const headers = new Headers();
      const resCt = upstream.headers.get("content-type");
      if (resCt) headers.set("content-type", resCt);
      return new Response(upstream.body, { status: upstream.status, headers });
    }

    if (url.pathname.startsWith(`${TMDB_PREFIX}/`) && request.method === "GET") {
      const token = env.TMDB_READ_ACCESS_TOKEN;
      if (!token) return json({ error: "TMDB is not configured" }, 503);

      const rest = url.pathname.slice(TMDB_PREFIX.length);
      const target = new URL(`https://api.themoviedb.org${rest}${url.search}`);

      return fetch(target, {
        headers: {
          Authorization: `Bearer ${token}`,
          accept: "application/json"
        }
      });
    }

    if (url.pathname.startsWith("/api/")) {
      return new Response(null, { status: 404 });
    }

    return new Response(null, { status: 404 });
  }
} satisfies ExportedHandler<Env>;
