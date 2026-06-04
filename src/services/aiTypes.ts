import type { OnboardingAnswers, TasteProfile, Title } from "../types";

export interface AiRerankRequest {
  answers: OnboardingAnswers;
  profile: TasteProfile;
  candidates: Title[];
  watchRegion: string;
  historyHints?: AiHistoryHints;
}

export interface AiGenerateRequest {
  answers: OnboardingAnswers;
  profile: TasteProfile;
  count: number;
  watchRegion: string;
  historyHints?: AiHistoryHints;
}

export interface AiHistoryHints {
  likedSample: string[];
  rejectedSample: string[];
  seenSample: string[];
  lastChosenLabel?: string;
  sessionCount: number;
}

export interface AiSuggestedTitle {
  name: string;
  type: "movie" | "series";
  reason?: string;
}
