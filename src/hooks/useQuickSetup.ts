import { YEAR_MAX, YEAR_MIN } from "../config/options";
import type { OnboardingAnswers } from "../types";
import { deriveSmartDefaultsFromProfile } from "../utils/appState";
import { sessionReducer } from "../state/sessionReducer";
import { useSessionStore } from "../state/sessionStore";

export function useQuickSetup() {
  const { session, profile, setSession } = useSessionStore();
  const answers = session.answers;
  const customYearRange = answers.customYearRange;
  const customYearStartPct = customYearRange
    ? ((customYearRange.min - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100
    : 0;
  const customYearEndPct = customYearRange
    ? ((customYearRange.max - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100
    : 100;

  function updateAnswers(next: Partial<OnboardingAnswers>) {
    setSession((prev) => sessionReducer(prev, { type: "UPDATE_ANSWERS", next }));
  }

  function beginOnboarding() {
    const smartDefaults = deriveSmartDefaultsFromProfile(profile);
    updateAnswers({
      ...smartDefaults,
      moods: [],
      languages: ["en"],
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
    toggleCustomYearRange,
    updateCustomYearRange
  };
}
