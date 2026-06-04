import { throwIfApiGateError, isOpenAiCompletionsUrl } from "./apiErrors";
import { getTurnstileToken, isTurnstileConfigured } from "./turnstile";

const DEFAULT_TIMEOUT_MS = 28_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_BASE_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface FetchWithRetryOptions {
  timeoutMs?: number;
  retries?: number;
  retryBaseDelayMs?: number;
}

export async function fetchWithTimeoutAndRetries(
  url: string,
  init: RequestInit,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = options.retries ?? DEFAULT_RETRIES;
  const retryBaseDelayMs = options.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_MS;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const requestInit = await withOpenAiGateHeaders(url, init);
      const response = await fetch(url, { ...requestInit, signal: controller.signal });
      clearTimeout(timer);

      await throwIfApiGateError(response);

      if (response.ok) return response;
      if (response.status >= 400 && response.status < 500) return response;

      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
    }

    if (attempt < retries) {
      await sleep(retryBaseDelayMs * (attempt + 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function withOpenAiGateHeaders(url: string, init: RequestInit): Promise<RequestInit> {
  if (!isOpenAiCompletionsUrl(url) || !isTurnstileConfigured()) return init;

  const token = await getTurnstileToken();
  const headers = new Headers(init.headers ?? {});
  headers.set("X-Turnstile-Token", token);
  return { ...init, headers };
}
