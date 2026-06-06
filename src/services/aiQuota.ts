import { ApiGateError } from "./apiErrors";
import { loadBackendConfig } from "./backendConfig";

/** One generate call fills a 10-card deck. */
export const AI_REQUESTS_PER_DECK = 1;

export type AiQuota = {
  count: number;
  limit: number;
  remaining: number;
  limited: boolean;
};

export async function fetchAiQuota(): Promise<AiQuota | null> {
  const config = await loadBackendConfig();
  if (!config.ai) return null;

  const response = await fetch("/api/ai-quota");
  if (!response.ok) return null;

  const data = (await response.json()) as Partial<AiQuota>;
  const limit = Number(data.limit);
  const count = Number(data.count);
  if (!Number.isFinite(limit) || !Number.isFinite(count)) return null;

  const remaining =
    typeof data.remaining === "number" && Number.isFinite(data.remaining)
      ? Math.max(0, Math.floor(data.remaining))
      : Math.max(0, Math.floor(limit) - Math.floor(count));

  return {
    count: Math.floor(count),
    limit: Math.floor(limit),
    remaining,
    limited: Boolean(data.limited)
  };
}

export function assertCanBuildAiDeck(quota: AiQuota | null): void {
  if (!quota?.limited) return;
  if (quota.remaining >= AI_REQUESTS_PER_DECK) return;
  throw new ApiGateError("Daily deck limit reached", 429, "rate_limit");
}
