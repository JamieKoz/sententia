import { configureTurnstile } from "./turnstile";

export type BackendConfig = {
  ai: boolean;
  tmdb: boolean;
  openaiModels: string[];
  turnstileSiteKey: string | null;
  turnstileRequired: boolean;
  aiDailyLimit: number;
};

let cached: Promise<BackendConfig> | null = null;

export function loadBackendConfig(): Promise<BackendConfig> {
  if (!cached) {
    cached = fetch("/api/config")
      .then(async (response) => {
        if (!response.ok) {
          return defaultBackendConfig();
        }
        const data = (await response.json()) as Partial<BackendConfig>;
        const config = normalizeBackendConfig(data);
        configureTurnstile(config.turnstileSiteKey);
        return config;
      })
      .catch(() => defaultBackendConfig());
  }
  return cached;
}

export function resetBackendConfigCache(): void {
  cached = null;
}

function defaultBackendConfig(): BackendConfig {
  return {
    ai: false,
    tmdb: false,
    openaiModels: [],
    turnstileSiteKey: null,
    turnstileRequired: false,
    aiDailyLimit: 30
  };
}

function normalizeBackendConfig(data: Partial<BackendConfig>): BackendConfig {
  const defaults = defaultBackendConfig();
  const limit = Number(data.aiDailyLimit);
  return {
    ai: Boolean(data.ai),
    tmdb: Boolean(data.tmdb),
    openaiModels: Array.isArray(data.openaiModels) ? data.openaiModels : [],
    turnstileSiteKey:
      typeof data.turnstileSiteKey === "string" && data.turnstileSiteKey.trim()
        ? data.turnstileSiteKey.trim()
        : null,
    turnstileRequired: Boolean(data.turnstileRequired),
    aiDailyLimit: Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : defaults.aiDailyLimit
  };
}
