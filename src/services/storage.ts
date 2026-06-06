import { createDefaultProfile } from "../engine/profile";
import { DEFAULT_WATCH_REGION, normalizeWatchRegion } from "../config/regions";
import type { OnboardingAnswers, TasteProfile, ViewerPrefs } from "../types";

export function createDefaultViewerPrefs(): ViewerPrefs {
  return {
    version: 1,
    watchRegion: DEFAULT_WATCH_REGION,
    source: "auto"
  };
}

const PROFILE_KEY = "couchpicks.tasteProfile.v1";
const ANSWERS_KEY = "couchpicks.lastAnswers.v1";
const VIEWER_PREFS_KEY = "couchpicks.viewerPrefs.v1";

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
  const raw = safeGetItem(ANSWERS_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Partial<OnboardingAnswers>;
  } catch {
    return {};
  }
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

export function resetPersonalization(): void {
  safeRemoveItem(PROFILE_KEY);
  safeRemoveItem(ANSWERS_KEY);
  safeRemoveItem(VIEWER_PREFS_KEY);
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
