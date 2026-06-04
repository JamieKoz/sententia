export type AppPhase = "questions" | "swipe" | "showdown" | "result";

export type TitleType = "movie" | "series";
export type RuntimeBucket = "short" | "standard" | "long";

export type SwipeAction = "keep" | "pass";

export type ViewerRegionSource = "auto" | "manual";

/** Persisted watch country for TMDB, affiliates, and shared sessions. */
export interface ViewerPrefs {
  version: 1;
  watchRegion: string;
  source: ViewerRegionSource;
  detectedAt?: string;
}

export interface OnboardingAnswers {
  quickModeId?: string;
  moods?: string[];
  preferredType?: TitleType | "either";
  runtime?: RuntimeBucket | "any";
  languages?: string[];
  releaseWindow?: "any" | "2020s" | "2010s" | "2000s" | "pre-2000";
  customYearRange?: { min: number; max: number } | null;
  familiarities?: Array<"popular" | "hidden-gems" | "for-kids" | "adults-only" | "acclaimed">;
  providers?: string[];
  hardExclusions?: string[];
  keywords?: string[];
  usePersonalization: boolean;
}

export interface Title {
  id: string;
  name: string;
  type: TitleType;
  runtimeMinutes: number;
  genres: string[];
  moods: string[];
  language: string;
  providers: string[];
  popularity: number;
  releaseYear: number;
  posterPath?: string | null;
  overview: string;
  rating?: number;
  cast?: string[];
}

export interface TasteProfile {
  version: 1;
  updatedAt: string;
  preferredType?: TitleType;
  runtimeAffinity: Record<RuntimeBucket, number>;
  moodAffinity: Record<string, number>;
  genreAffinity: Record<string, number>;
  typeAffinity: Record<TitleType, number>;
  languageAffinity: Record<string, number>;
  providerAffinity: Record<string, number>;
  likedIds: string[];
  rejectedIds: string[];
  seenIds: string[];
  sessionCount: number;
  lastChosenTitle?: string;
}

export interface SessionState {
  phase: AppPhase;
  sessionId: string;
  answers: OnboardingAnswers;
  deck: string[];
  deckCursor: number;
  shortlist: string[];
  passed: string[];
  showdownQueue: string[];
  winnerId?: string;
  backupId?: string;
}

export interface ScoreInput {
  title: Title;
  answers: OnboardingAnswers;
  profile: TasteProfile;
}
