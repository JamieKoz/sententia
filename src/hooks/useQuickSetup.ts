import { YEAR_MAX, YEAR_MIN } from "../config/options";
import type { OnboardingAnswers, SessionState, TasteProfile } from "../types";
import { deriveSmartDefaultsFromProfile } from "../utils/appState";

export function useQuickSetup(params: {
  answers: OnboardingAnswers;
  profile: TasteProfile;
  setSession: React.Dispatch<React.SetStateAction<SessionState>>;
}) {
  const { answers, profile, setSession } = params;
  const customYearRange = answers.customYearRange;
  const customYearStartPct = customYearRange
    ? ((customYearRange.min - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100
    : 0;
  const customYearEndPct = customYearRange
    ? ((customYearRange.max - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100
    : 100;

  function updateAnswers(next: Partial<OnboardingAnswers>) {
    setSession((prev) => ({
      ...prev,
      answers: {
        ...prev.answers,
        ...next
      }
    }));
  }

  function beginOnboarding() {
    const smartDefaults = deriveSmartDefaultsFromProfile(profile);
    updateAnswers({
      ...smartDefaults,
      moods: [],
      quickModeId: undefined
    });
  }

  function toggleProvider(provider: string) {
    const selected = answers.providers?.includes(provider);
    updateAnswers({
      providers: selected
        ? answers.providers?.filter((value) => value !== provider)
        : [...(answers.providers ?? []), provider]
    });
  }

  function toggleExclusion(exclusion: string) {
    const selected = answers.hardExclusions?.includes(exclusion);
    updateAnswers({
      hardExclusions: selected
        ? answers.hardExclusions?.filter((value) => value !== exclusion)
        : [...(answers.hardExclusions ?? []), exclusion]
    });
  }

  function toggleMood(mood: string) {
    const selected = answers.moods?.includes(mood);
    updateAnswers({
      moods: selected ? answers.moods?.filter((value) => value !== mood) : [...(answers.moods ?? []), mood]
    });
  }

  function toggleLanguage(language: string) {
    if (language === "any") {
      updateAnswers({ languages: [] });
      return;
    }
    const selected = answers.languages?.includes(language);
    updateAnswers({
      languages: selected
        ? answers.languages?.filter((value) => value !== language)
        : [...(answers.languages ?? []), language]
    });
  }

  function toggleFamiliarity(familiarity: "any" | "popular" | "hidden-gems" | "for-kids") {
    if (familiarity === "any") {
      updateAnswers({ familiarities: [] });
      return;
    }
    const selected = answers.familiarities?.includes(familiarity);
    updateAnswers({
      familiarities: selected
        ? answers.familiarities?.filter((value) => value !== familiarity)
        : [...(answers.familiarities ?? []), familiarity]
    });
  }

  function toggleCustomYearRange() {
    if (answers.customYearRange) {
      updateAnswers({ customYearRange: null });
      return;
    }
    updateAnswers({
      customYearRange: { min: 2000, max: YEAR_MAX }
    });
  }

  function updateCustomYearRange(next: Partial<{ min: number; max: number }>) {
    const current = answers.customYearRange ?? { min: 2000, max: YEAR_MAX };
    const merged = { ...current, ...next };
    const min = Math.max(YEAR_MIN, Math.min(merged.min, merged.max));
    const max = Math.min(YEAR_MAX, Math.max(merged.max, min));
    updateAnswers({ customYearRange: { min, max } });
  }

  return {
    customYearStartPct,
    customYearEndPct,
    updateAnswers,
    beginOnboarding,
    toggleProvider,
    toggleExclusion,
    toggleMood,
    toggleLanguage,
    toggleFamiliarity,
    toggleCustomYearRange,
    updateCustomYearRange
  };
}
