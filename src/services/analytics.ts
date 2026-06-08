export type AnalyticsProps = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: Record<string, string | number | boolean> }) => void;
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackEvent(event: string, props: AnalyticsProps = {}): void {
  if (typeof window === "undefined") return;

  const detail = { event, ...props };
  window.dispatchEvent(new CustomEvent("sententia:analytics", { detail }));

  if (typeof window.plausible === "function") {
    const plausibleProps: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(props)) {
      if (value !== undefined) plausibleProps[key] = value;
    }
    window.plausible(event, { props: plausibleProps });
  }

  if (typeof window.gtag === "function") {
    window.gtag("event", event, props);
  }
}
