const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  ready: (cb: () => void) => void;
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  execute: (widgetId: string, options?: Record<string, unknown>) => void;
  reset: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;
let widgetId: string | null = null;
let container: HTMLDivElement | null = null;
let configuredSiteKey: string | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Turnstile requires a browser"));
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src^="https://challenges.cloudflare.com/turnstile"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Turnstile script failed")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Turnstile script failed"));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

function ensureContainer(): HTMLDivElement {
  if (container) return container;
  container = document.createElement("div");
  container.id = "turnstile-host";
  container.className = "sr-only";
  container.setAttribute("aria-hidden", "true");
  document.body.appendChild(container);
  return container;
}

export function configureTurnstile(siteKey: string | null | undefined): void {
  const key = siteKey?.trim();
  if (!key) {
    configuredSiteKey = null;
    return;
  }
  if (configuredSiteKey === key) return;
  configuredSiteKey = key;
  widgetId = null;
}

export function isTurnstileConfigured(): boolean {
  return Boolean(configuredSiteKey);
}

async function ensureWidget(): Promise<string> {
  const siteKey = configuredSiteKey;
  if (!siteKey) throw new Error("Turnstile is not configured");

  await loadTurnstileScript();
  const api = window.turnstile;
  if (!api) throw new Error("Turnstile API unavailable");

  if (widgetId) return widgetId;

  return new Promise((resolve, reject) => {
    api.ready(() => {
      try {
        const id = api.render(ensureContainer(), {
          sitekey: siteKey,
          size: "invisible",
          execution: "execute",
          appearance: "interaction-only"
        });
        widgetId = id;
        resolve(id);
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  });
}

export async function getTurnstileToken(): Promise<string> {
  const id = await ensureWidget();
  const api = window.turnstile;
  if (!api) throw new Error("Turnstile API unavailable");

  return new Promise((resolve, reject) => {
    api.execute(id, {
      callback: (token: string) => {
        api.reset(id);
        resolve(token);
      },
      "error-callback": () => reject(new Error("Turnstile challenge failed")),
      "expired-callback": () => reject(new Error("Turnstile challenge expired"))
    });
  });
}
