/// <reference types="@cloudflare/workers-types/2023-07-01" />

export const DEFAULT_AI_DAILY_LIMIT = 30;
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function clientIp(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export function dailyLimitKey(ip: string, dayUtc = utcDay()): string {
  return `ai:${ip}:${dayUtc}`;
}

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function verifyTurnstile(
  token: string | null,
  secret: string,
  ip: string | null
): Promise<boolean> {
  if (!token?.trim()) return false;

  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token.trim());
  if (ip && ip !== "unknown") form.append("remoteip", ip);

  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, { method: "POST", body: form });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

export function turnstileTokenFromRequest(request: Request): string | null {
  return request.headers.get("CF-Turnstile-Token") ?? request.headers.get("X-Turnstile-Token");
}

export function parseAiDailyLimit(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_AI_DAILY_LIMIT;
  return Math.floor(n);
}

export interface RateLimitCheck {
  allowed: boolean;
  count: number;
  limit: number;
}

export async function checkAndIncrementDailyLimit(
  kv: KVNamespace,
  ip: string,
  limit: number
): Promise<RateLimitCheck> {
  const key = dailyLimitKey(ip);
  const raw = await kv.get(key);
  const count = raw ? Number(raw) : 0;
  const current = Number.isFinite(count) ? count : 0;

  if (current >= limit) {
    return { allowed: false, count: current, limit };
  }

  const next = current + 1;
  await kv.put(key, String(next), { expirationTtl: 86_400 });
  return { allowed: true, count: next, limit };
}
