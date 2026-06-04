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

const PROFILE_KEY = "cinematch.tasteProfile.v1";
const ANSWERS_KEY = "cinematch.lastAnswers.v1";
const VIEWER_PREFS_KEY = "cinematch.viewerPrefs.v1";

export function loadProfile(): TasteProfile {
  const raw = window.localStorage.getItem(PROFILE_KEY);
  if (!raw) return createDefaultProfile();

  try {
    const parsed = JSON.parse(raw) as Partial<TasteProfile>;
    if (parsed.version !== 1) return createDefaultProfile();
    return {
      ...createDefaultProfile(),
      ...parsed,
      runtimeAffinity: {
        ...createDefaultProfile().runtimeAffinity,
        ...(parsed.runtimeAffinity ?? {})
      },
      typeAffinity: {
        ...createDefaultProfile().typeAffinity,
        ...(parsed.typeAffinity ?? {})
      }
    };
  } catch {
    return createDefaultProfile();
  }
}

export function saveProfile(profile: TasteProfile): void {
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function loadLastAnswers(): Partial<OnboardingAnswers> {
  const raw = window.localStorage.getItem(ANSWERS_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Partial<OnboardingAnswers>;
  } catch {
    return {};
  }
}

export function saveLastAnswers(answers: OnboardingAnswers): void {
  window.localStorage.setItem(ANSWERS_KEY, JSON.stringify(answers));
}

export function loadViewerPrefsFromStorage(): ViewerPrefs {
  const raw = window.localStorage.getItem(VIEWER_PREFS_KEY);
  if (!raw) return createDefaultViewerPrefs();

  try {
    const parsed = JSON.parse(raw) as Partial<ViewerPrefs>;
    if (parsed.version !== 1) return createDefaultViewerPrefs();
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
  window.localStorage.setItem(VIEWER_PREFS_KEY, JSON.stringify(prefs));
}

export function resetPersonalization(): void {
  window.localStorage.removeItem(PROFILE_KEY);
  window.localStorage.removeItem(ANSWERS_KEY);
  window.localStorage.removeItem(VIEWER_PREFS_KEY);
}
