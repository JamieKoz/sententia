import type { OnboardingAnswers, RuntimeBucket, ScoreInput, TasteProfile, Title } from "../types";
import { hasExcludedGenre, matchesCustomYearRange, matchesReleaseWindow } from "./constraints";

const KIDS_FRIENDLY_GENRES = new Set(["adventure", "comedy", "fantasy", "slice-of-life", "music"]);
const KIDS_UNFRIENDLY_GENRES = new Set(["crime", "thriller", "horror", "mystery", "legal"]);
const HARD_REJECT_SCORE = -9999;

const SCORING_WEIGHTS = {
  likedBoost: 1.4,
  preferredTypePenalty: 2,
  runtimePenalty: 1.5,
  languagePenalty: 1,
  releaseWindowPenalty: 1.5,
  moodMatchBoost: 3,
  keywordBoost: 1.2,
  providerMatchBoost: 2,
  seenPenalty: 2.5,
  popularityWeight: 0.8,
  recencyWeight: 0.4,
  familiarityPopularWeight: 0.9,
  familiarityHiddenGemsWeight: 0.9,
  familiarityAcclaimedWeight: 1.4,
  kidsFriendlyWeight: 1.4,
  kidsUnfriendlyPenalty: 1.8,
  adultsFriendlyPenalty: 1.3,
  adultsUnfriendlyWeight: 0.4,
  affinity: {
    genre: 0.8,
    mood: 0.9,
    runtime: 0.7,
    type: 0.8,
    language: 0.5,
    provider: 0.4
  }
} as const;

interface ScoringLookup {
  likedIds: Set<string>;
  rejectedIds: Set<string>;
  seenIds: Set<string>;
  moods: Set<string>;
  providers: Set<string>;
  keywordsLower: string[];
}

export function runtimeBucketFromMinutes(minutes: number): RuntimeBucket {
  if (minutes < 90) return "short";
  if (minutes <= 130) return "standard";
  return "long";
}

export function scoreCandidate({ title, answers, profile }: ScoreInput): number {
  const lookup = buildScoringLookup(answers, profile);
  return scoreCandidateWithLookup(title, answers, profile, lookup);
}

function scoreCandidateWithLookup(
  title: Title,
  answers: OnboardingAnswers,
  profile: TasteProfile,
  lookup: ScoringLookup
): number {
  let score = 0;

  if (lookup.rejectedIds.has(title.id)) return HARD_REJECT_SCORE;

  if (lookup.likedIds.has(title.id)) {
    score += SCORING_WEIGHTS.likedBoost;
  }

  if (hasExcludedGenre(title, answers.hardExclusions)) return HARD_REJECT_SCORE;

  if (answers.preferredType && answers.preferredType !== "either" && title.type !== answers.preferredType) {
    score -= SCORING_WEIGHTS.preferredTypePenalty;
  }

  const bucket = runtimeBucketFromMinutes(title.runtimeMinutes);
  if (answers.runtime && answers.runtime !== "any" && bucket !== answers.runtime) {
    score -= SCORING_WEIGHTS.runtimePenalty;
  }

  if (answers.languages.length > 0 && !answers.languages.includes(title.language)) {
    score -= SCORING_WEIGHTS.languagePenalty;
  }

  if (!matchesReleaseWindow(title.releaseYear, answers.releaseWindow)) {
    score -= SCORING_WEIGHTS.releaseWindowPenalty;
  }

  if (!matchesCustomYearRange(title.releaseYear, answers.customYearRange)) return HARD_REJECT_SCORE;

  if (lookup.moods.size > 0 && title.moods.some((mood) => lookup.moods.has(mood))) {
    score += SCORING_WEIGHTS.moodMatchBoost;
  }

  if (lookup.keywordsLower.length > 0) {
    const searchable = [title.name, title.overview, ...title.genres, ...title.moods].join(" ").toLowerCase();
    for (const keyword of lookup.keywordsLower) {
      if (searchable.includes(keyword)) {
        score += SCORING_WEIGHTS.keywordBoost;
      }
    }
  }

  if (lookup.providers.size > 0) {
    const matchesProvider = title.providers.some((provider) => lookup.providers.has(provider));
    if (matchesProvider) score += SCORING_WEIGHTS.providerMatchBoost;
  }

  score += affinityScore(title, profile, bucket);

  if (lookup.seenIds.has(title.id)) {
    score -= SCORING_WEIGHTS.seenPenalty;
  }

  score += title.popularity * SCORING_WEIGHTS.popularityWeight;
  score += normalizeRecency(title.releaseYear) * SCORING_WEIGHTS.recencyWeight;

  if (answers.familiarities?.includes("popular")) {
    score += title.popularity * SCORING_WEIGHTS.familiarityPopularWeight;
  }
  if (answers.familiarities?.includes("hidden-gems")) {
    score += (1 - title.popularity) * SCORING_WEIGHTS.familiarityHiddenGemsWeight;
  }

  if (answers.familiarities?.includes("acclaimed")) {
    score += (title.rating ?? 0.55) * SCORING_WEIGHTS.familiarityAcclaimedWeight;
  }

  const friendlyMatches = title.genres.filter((genre) => KIDS_FRIENDLY_GENRES.has(genre)).length;
  const unfriendlyMatches = title.genres.filter((genre) => KIDS_UNFRIENDLY_GENRES.has(genre)).length;

  if (answers.familiarities?.includes("for-kids")) {
    score += friendlyMatches * SCORING_WEIGHTS.kidsFriendlyWeight;
    score -= unfriendlyMatches * SCORING_WEIGHTS.kidsUnfriendlyPenalty;
  }

  if (answers.familiarities?.includes("adults-only")) {
    score -= friendlyMatches * SCORING_WEIGHTS.adultsFriendlyPenalty;
    score += unfriendlyMatches * SCORING_WEIGHTS.adultsUnfriendlyWeight;
  }

  return score;
}

export function rankTitles(titles: Title[], answers: OnboardingAnswers, profile: TasteProfile): Title[] {
  const lookup = buildScoringLookup(answers, profile);
  return titles
    .map((title) => ({
      title,
      score: scoreCandidateWithLookup(title, answers, profile, lookup)
    }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.title);
}

function buildScoringLookup(answers: OnboardingAnswers, profile: TasteProfile): ScoringLookup {
  return {
    likedIds: new Set(profile.likedIds),
    rejectedIds: new Set(profile.rejectedIds),
    seenIds: new Set(profile.seenIds),
    moods: new Set(answers.moods),
    providers: new Set(answers.providers),
    keywordsLower: answers.keywords.map((keyword) => keyword.toLowerCase())
  };
}

function normalizeRecency(year: number): number {
  const now = new Date().getFullYear();
  const diff = Math.max(0, now - year);
  if (diff <= 1) return 1;
  if (diff <= 3) return 0.8;
  if (diff <= 6) return 0.6;
  if (diff <= 10) return 0.3;
  return 0.1;
}

function affinityScore(title: Title, profile: TasteProfile, bucket: RuntimeBucket): number {
  let score = 0;
  for (const genre of title.genres) {
    score += (profile.genreAffinity[genre] ?? 0) * SCORING_WEIGHTS.affinity.genre;
  }
  for (const mood of title.moods) {
    score += (profile.moodAffinity[mood] ?? 0) * SCORING_WEIGHTS.affinity.mood;
  }
  score += (profile.runtimeAffinity[bucket] ?? 0) * SCORING_WEIGHTS.affinity.runtime;
  score += (profile.typeAffinity[title.type] ?? 0) * SCORING_WEIGHTS.affinity.type;
  score += (profile.languageAffinity[title.language] ?? 0) * SCORING_WEIGHTS.affinity.language;
  for (const provider of title.providers) {
    score += (profile.providerAffinity[provider] ?? 0) * SCORING_WEIGHTS.affinity.provider;
  }
  return score;
}
