import { createDefaultProfile } from "../engine/profile";
import { DEFAULT_WATCH_REGION, normalizeWatchRegion } from "../config/regions";
import type { OnboardingAnswers, TasteProfile, Title, ViewerPrefs } from "../types";

export function createDefaultViewerPrefs(): ViewerPrefs {
  return {
    version: 1,
    watchRegion: DEFAULT_WATCH_REGION,
    source: "auto"
  };
}

const PROFILE_KEY = "sententia.tasteProfile.v1";
const ANSWERS_KEY = "sententia.lastAnswers.v1";
const VIEWER_PREFS_KEY = "sententia.viewerPrefs.v1";
const SAVED_PICKS_KEY = "sententia.savedPicks.v1";
const WATCHED_TITLES_KEY = "sententia.watchedTitles.v1";
const GROUP_HISTORY_KEY = "sententia.groupHistory.v1";
const MAX_LIBRARY_ITEMS = 200;
const MAX_GROUP_HISTORY = 60;

export interface SavedPickEntry {
  title: Title;
  savedAt: string;
  source: "solo" | "group";
}

export interface WatchedTitleEntry {
  title: Title;
  watchedAt: string;
  rating?: number;
  source: "solo" | "group";
}

export interface GroupHistoryEntry {
  roomCode: string;
  recordedAt: string;
  myPick?: Title;
  partnerPick?: Title;
  sharedCompromise?: Title;
  overlapTitles: Title[];
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function safeGetItem(key: string): string | null {
  if (!isBrowser()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore write failures (private mode/quota) and keep app usable.
  }
}

function safeRemoveItem(key: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage removal failures.
  }
}

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadProfile(): TasteProfile {
  const raw = safeGetItem(PROFILE_KEY);
  if (!raw) return createDefaultProfile();

  try {
    const parsed = JSON.parse(raw) as Partial<TasteProfile>;
    if (parsed.version !== 1) {
      return migrateProfile(parsed);
    }
    const defaults = createDefaultProfile();
    return {
      ...defaults,
      ...parsed,
      runtimeAffinity: {
        ...defaults.runtimeAffinity,
        ...(parsed.runtimeAffinity ?? {})
      },
      typeAffinity: {
        ...defaults.typeAffinity,
        ...(parsed.typeAffinity ?? {})
      }
    };
  } catch {
    return createDefaultProfile();
  }
}

export function saveProfile(profile: TasteProfile): void {
  safeSetItem(PROFILE_KEY, JSON.stringify(profile));
}

export function loadLastAnswers(): Partial<OnboardingAnswers> {
  return safeJsonParse<Partial<OnboardingAnswers>>(safeGetItem(ANSWERS_KEY), {});
}

export function saveLastAnswers(answers: OnboardingAnswers): void {
  safeSetItem(ANSWERS_KEY, JSON.stringify(answers));
}

export function loadViewerPrefsFromStorage(): ViewerPrefs {
  const raw = safeGetItem(VIEWER_PREFS_KEY);
  if (!raw) return createDefaultViewerPrefs();

  try {
    const parsed = JSON.parse(raw) as Partial<ViewerPrefs>;
    if (parsed.version !== 1) {
      return migrateViewerPrefs(parsed);
    }
    return {
      version: 1,
      watchRegion: normalizeWatchRegion(parsed.watchRegion),
      source: parsed.source === "manual" ? "manual" : "auto",
      detectedAt: typeof parsed.detectedAt === "string" ? parsed.detectedAt : undefined
    };
  } catch {
    return createDefaultViewerPrefs();
  }
}

export function saveViewerPrefsToStorage(prefs: ViewerPrefs): void {
  safeSetItem(VIEWER_PREFS_KEY, JSON.stringify(prefs));
}

export function loadSavedPicks(): SavedPickEntry[] {
  const list = safeJsonParse<SavedPickEntry[]>(safeGetItem(SAVED_PICKS_KEY), []);
  return Array.isArray(list) ? list : [];
}

export function isTitleSaved(titleId: string): boolean {
  return loadSavedPicks().some((entry) => entry.title.id === titleId);
}

export function toggleSavedPick(title: Title, source: "solo" | "group"): boolean {
  const saved = loadSavedPicks();
  const existing = saved.findIndex((entry) => entry.title.id === title.id);
  if (existing >= 0) {
    saved.splice(existing, 1);
    safeSetItem(SAVED_PICKS_KEY, JSON.stringify(saved));
    return false;
  }

  const next: SavedPickEntry = {
    title,
    source,
    savedAt: new Date().toISOString()
  };
  const deduped = [next, ...saved.filter((entry) => entry.title.id !== title.id)].slice(0, MAX_LIBRARY_ITEMS);
  safeSetItem(SAVED_PICKS_KEY, JSON.stringify(deduped));
  return true;
}

export function loadWatchedTitles(): WatchedTitleEntry[] {
  const list = safeJsonParse<WatchedTitleEntry[]>(safeGetItem(WATCHED_TITLES_KEY), []);
  return Array.isArray(list) ? list : [];
}

export function isTitleWatched(titleId: string): boolean {
  return loadWatchedTitles().some((entry) => entry.title.id === titleId);
}

export function loadWatchedTitleIds(): string[] {
  return loadWatchedTitles().map((entry) => entry.title.id);
}

export function markTitleWatched(
  title: Title,
  options: { source: "solo" | "group"; rating?: number }
): WatchedTitleEntry {
  const watched = loadWatchedTitles();
  const next: WatchedTitleEntry = {
    title,
    source: options.source,
    watchedAt: new Date().toISOString(),
    rating: options.rating
  };
  const deduped = [next, ...watched.filter((entry) => entry.title.id !== title.id)].slice(0, MAX_LIBRARY_ITEMS);
  safeSetItem(WATCHED_TITLES_KEY, JSON.stringify(deduped));
  return next;
}

export function updateWatchedRating(titleId: string, rating: number): WatchedTitleEntry | null {
  const watched = loadWatchedTitles();
  const index = watched.findIndex((entry) => entry.title.id === titleId);
  if (index < 0) return null;
  const rounded = Math.max(1, Math.min(5, Math.round(rating)));
  const current = watched[index]!;
  const updated: WatchedTitleEntry = {
    ...current,
    rating: rounded
  };
  watched.splice(index, 1);
  safeSetItem(WATCHED_TITLES_KEY, JSON.stringify([updated, ...watched]));
  return updated;
}

export function loadGroupHistory(): GroupHistoryEntry[] {
  const list = safeJsonParse<GroupHistoryEntry[]>(safeGetItem(GROUP_HISTORY_KEY), []);
  return Array.isArray(list) ? list : [];
}

export function upsertGroupHistory(entry: GroupHistoryEntry): void {
  if (!entry.roomCode.trim()) return;
  const existing = loadGroupHistory();
  const next = [
    entry,
    ...existing.filter((item) => item.roomCode.toUpperCase() !== entry.roomCode.toUpperCase())
  ].slice(0, MAX_GROUP_HISTORY);
  safeSetItem(GROUP_HISTORY_KEY, JSON.stringify(next));
}

export function resetPersonalization(): void {
  safeRemoveItem(PROFILE_KEY);
  safeRemoveItem(ANSWERS_KEY);
  safeRemoveItem(VIEWER_PREFS_KEY);
  safeRemoveItem(SAVED_PICKS_KEY);
  safeRemoveItem(WATCHED_TITLES_KEY);
  safeRemoveItem(GROUP_HISTORY_KEY);
}

function migrateProfile(parsed: Partial<TasteProfile>): TasteProfile {
  // v0 or unknown versions: best-effort merge into current defaults.
  const defaults = createDefaultProfile();
  return {
    ...defaults,
    ...parsed,
    version: 1,
    runtimeAffinity: {
      ...defaults.runtimeAffinity,
      ...(parsed.runtimeAffinity ?? {})
    },
    typeAffinity: {
      ...defaults.typeAffinity,
      ...(parsed.typeAffinity ?? {})
    }
  };
}

function migrateViewerPrefs(parsed: Partial<ViewerPrefs>): ViewerPrefs {
  return {
    version: 1,
    watchRegion: normalizeWatchRegion(parsed.watchRegion ?? DEFAULT_WATCH_REGION),
    source: parsed.source === "manual" ? "manual" : "auto",
    detectedAt: typeof parsed.detectedAt === "string" ? parsed.detectedAt : undefined
  };
}
