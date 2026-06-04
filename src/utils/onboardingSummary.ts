import {
  DISCOVERY_AUDIENCE_OPTIONS,
  DISCOVERY_POPULARITY_OPTIONS,
  getDiscoveryAudience,
  getLanguageOption,
  getPopularityTokens,
  MOOD_CHIPS,
  PROVIDER_OPTIONS,
  RELEASE_TIMELINE_SEGMENTS,
  RUNTIME_OPTIONS,
  TYPE_OPTIONS
} from "../config/options";
import { watchRegionLabel } from "../config/regions";
import type { OnboardingAnswers } from "../types";

export type OnboardingSummaryRow = {
  label: string;
  value: string;
};

function joinLabels(labels: string[], empty = "—"): string {
  return labels.length ? labels.join(", ") : empty;
}

function formatRelease(answers: OnboardingAnswers): string {
  if (answers.customYearRange) {
    return `${answers.customYearRange.min}–${answers.customYearRange.max}`;
  }
  const window = answers.releaseWindow ?? "any";
  if (window === "any") return "Any era";
  const segment = RELEASE_TIMELINE_SEGMENTS.find((item) => item.value === window);
  return segment?.label ?? window;
}

function formatDiscoveryStyle(answers: OnboardingAnswers): string {
  const tokens = getPopularityTokens(answers.familiarities);
  if (!tokens.length) {
    return DISCOVERY_POPULARITY_OPTIONS.find((item) => item.id === "balanced")?.label ?? "Surprise me";
  }
  return joinLabels(
    tokens.map((token) => DISCOVERY_POPULARITY_OPTIONS.find((item) => item.id === token)?.label ?? token)
  );
}

function formatAudience(answers: OnboardingAnswers): string {
  const id = getDiscoveryAudience(answers.familiarities);
  return DISCOVERY_AUDIENCE_OPTIONS.find((item) => item.id === id)?.label ?? "General";
}

export function formatOnboardingSummary(
  answers: OnboardingAnswers,
  watchRegion?: string
): OnboardingSummaryRow[] {
  const moods = (answers.moods ?? []).map(
    (value) => MOOD_CHIPS.find((mood) => mood.value === value)?.label ?? value
  );

  const type =
    TYPE_OPTIONS.find((item) => item.value === (answers.preferredType ?? "either"))?.label ?? "Either";

  const runtime =
    RUNTIME_OPTIONS.find((item) => item.value === (answers.runtime ?? "any"))?.label ?? "Any";

  const languages = (answers.languages ?? ["en"]).map(
    (code) => getLanguageOption(code)?.label ?? code.toUpperCase()
  );

  const providers = (answers.providers ?? []).map(
    (id) => PROVIDER_OPTIONS.find((item) => item.id === id)?.label ?? id
  );

  const avoid = answers.hardExclusions ?? [];
  const keywords = answers.keywords ?? [];

  const rows: OnboardingSummaryRow[] = [
    { label: "Mood", value: joinLabels(moods) },
    { label: "Format", value: type },
    { label: "Runtime", value: runtime },
    { label: "Release", value: formatRelease(answers) },
    { label: "Language", value: joinLabels(languages) },
    { label: "Discovery", value: formatDiscoveryStyle(answers) },
    { label: "Watching with", value: formatAudience(answers) },
    { label: "Provider", value: providers.length ? joinLabels(providers) : "No preference" },
    { label: "Avoid", value: avoid.length ? joinLabels(avoid) : "None" },
    { label: "Keywords", value: keywords.length ? keywords.join(", ") : "None" }
  ];

  if (watchRegion) {
    rows.splice(6, 0, { label: "Region", value: watchRegionLabel(watchRegion) });
  }

  return rows;
}
