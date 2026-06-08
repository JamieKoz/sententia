import { formatProviderLabels } from "../config/options";
import { runtimeBucketFromMinutes } from "../engine/scoring";
import type { OnboardingAnswers, TasteProfile, Title } from "../types";

function topAffinity(affinity: Record<string, number>, max = 2): string[] {
  return Object.entries(affinity)
    .filter(([, score]) => score > 0.6)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([key]) => key);
}

export function buildWhyThisPick(title: Title, answers: OnboardingAnswers, profile: TasteProfile): string[] {
  const reasons: string[] = [];

  reasons.push("It ranked strongly against your current filters and taste profile.");

  const matchedMoods = title.moods.filter((mood) => answers.moods.includes(mood));
  if (matchedMoods.length > 0) {
    reasons.push(`Matches your vibe: ${matchedMoods.join(", ")}.`);
  }

  if (answers.providers.length > 0) {
    const matchedProviders = title.providers.filter((provider) => answers.providers.includes(provider));
    if (matchedProviders.length > 0) {
      reasons.push(`Available on your selected services (${formatProviderLabels(matchedProviders)}).`);
    }
  }

  if (answers.runtime !== "any" && runtimeBucketFromMinutes(title.runtimeMinutes) === answers.runtime) {
    reasons.push(`Fits your preferred length for tonight.`);
  }

  const topGenres = topAffinity(profile.genreAffinity, 2).filter((genre) => title.genres.includes(genre));
  if (topGenres.length > 0) {
    reasons.push(`You consistently lean toward ${topGenres.join(" and ")}.`);
  }

  const topMoods = topAffinity(profile.moodAffinity, 2).filter((mood) => title.moods.includes(mood));
  if (topMoods.length > 0) {
    reasons.push(`Your recent swipes favor this tone (${topMoods.join(", ")}).`);
  }

  if (reasons.length === 0) {
    reasons.push("It matched your current filters closely enough to be included in this deck.");
  }

  return reasons.slice(0, 3);
}

export function summarizeTasteProfile(profile: TasteProfile): string[] {
  const summary: string[] = [];
  const favoriteGenres = topAffinity(profile.genreAffinity, 2);
  const favoriteMoods = topAffinity(profile.moodAffinity, 2);

  if (favoriteGenres.length > 0) {
    summary.push(`Top genres: ${favoriteGenres.join(", ")}`);
  }
  if (favoriteMoods.length > 0) {
    summary.push(`Top moods: ${favoriteMoods.join(", ")}`);
  }

  const runtime = Object.entries(profile.runtimeAffinity).sort((a, b) => b[1] - a[1])[0];
  if (runtime && runtime[1] > 0.4) {
    summary.push(`Preferred runtime: ${runtime[0]}`);
  }

  if (summary.length === 0) {
    summary.push("Still learning your taste - keep swiping to personalize picks.");
  }
  return summary;
}
