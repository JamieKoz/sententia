import { normalizeWatchRegion, watchRegionLabel } from "../config/regions";
import type { ViewerPrefs, ViewerRegionSource } from "../types";
import {
  createDefaultViewerPrefs,
  loadViewerPrefsFromStorage,
  saveViewerPrefsToStorage
} from "./storage";

export { createDefaultViewerPrefs };

export function loadViewerPrefs(): ViewerPrefs {
  return loadViewerPrefsFromStorage();
}

export function saveViewerPrefs(prefs: ViewerPrefs): void {
  saveViewerPrefsToStorage(prefs);
}

/** JSON safe to embed in a share link or room payload later. */
export function viewerPrefsForShare(prefs: ViewerPrefs): Pick<ViewerPrefs, "watchRegion" | "source"> {
  return { watchRegion: prefs.watchRegion, source: prefs.source };
}

export function parseSharedViewerPrefs(raw: unknown): ViewerPrefs | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.watchRegion !== "string") return null;
  const source: ViewerRegionSource = o.source === "manual" ? "manual" : "auto";
  return {
    version: 1,
    watchRegion: normalizeWatchRegion(o.watchRegion),
    source,
    detectedAt: typeof o.detectedAt === "string" ? o.detectedAt : undefined
  };
}

export function setManualWatchRegion(prefs: ViewerPrefs, watchRegion: string): ViewerPrefs {
  return {
    ...prefs,
    watchRegion: normalizeWatchRegion(watchRegion),
    source: "manual"
  };
}

export async function fetchDetectedCountry(): Promise<string | null> {
  try {
    const res = await fetch("/api/viewer-region");
    if (!res.ok) return null;
    const data = (await res.json()) as { country?: string | null };
    const country = data.country?.trim();
    return country ? country.toUpperCase() : null;
  } catch {
    return null;
  }
}

function localeFallbackCountry(): string | null {
  if (typeof navigator === "undefined") return null;
  const tag = navigator.language?.split("-")[1]?.toUpperCase();
  return tag && tag.length === 2 ? tag : null;
}

/** Apply geo hint without overriding a manual choice. */
export async function bootstrapViewerPrefs(): Promise<ViewerPrefs> {
  const stored = loadViewerPrefs();
  if (stored.source === "manual") return stored;

  const detected = (await fetchDetectedCountry()) ?? localeFallbackCountry();
  if (!detected) return stored;

  const watchRegion = normalizeWatchRegion(detected);
  if (stored.watchRegion === watchRegion && stored.detectedAt) return stored;

  const next: ViewerPrefs = {
    version: 1,
    watchRegion,
    source: "auto",
    detectedAt: new Date().toISOString()
  };
  saveViewerPrefs(next);
  return next;
}

export function formatViewerRegionHint(prefs: ViewerPrefs): string {
  const label = watchRegionLabel(prefs.watchRegion);
  return prefs.source === "manual" ? label : `${label} (detected)`;
}
