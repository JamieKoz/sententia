import { watchRegionLabel } from "../config/regions";
import type { AiGenerateRequest, AiHistoryHints, AiRerankRequest } from "./aiTypes";

function compactHistory(h?: AiHistoryHints) {
  if (!h) return undefined;
  return {
    likedSample: h.likedSample,
    rejectedSample: h.rejectedSample,
    seenSample: h.seenSample,
    lastChosenLabel: h.lastChosenLabel,
    sessionCount: h.sessionCount,
    guidance: [
      "Prefer titles similar to likedSample; avoid anything resembling rejectedSample themes.",
      h.lastChosenLabel
        ? `User recently chose something like: ${h.lastChosenLabel}. Lean that direction when ties exist.`
        : undefined,
      h.sessionCount > 2
        ? "Returning user: favor slightly bolder or deeper matches while staying on-brief."
        : undefined
    ].filter(Boolean)
  };
}

export function buildRerankPrompt(req: AiRerankRequest): string {
  const compactCandidates = req.candidates.map((title) => ({
    id: title.id,
    name: title.name,
    type: title.type,
    runtimeMinutes: title.runtimeMinutes,
    releaseYear: title.releaseYear,
    popularity: title.popularity,
    rating: title.rating,
    overview: title.overview?.slice(0, 360),
    cast: title.cast?.slice(0, 6),
    genres: title.genres,
    moods: title.moods,
    language: title.language,
    providers: title.providers
  }));

  return JSON.stringify({
    task: "Re-rank candidates based on user intent and preference signals.",
    rules: [
      "Candidates already satisfy hard filters; focus on best fit, not validity.",
      "Keep items that match explicit onboarding answers highest.",
      "Use taste profile affinities and history hints as secondary signals.",
      "Prefer diverse top picks but still relevance-first.",
      "Return orderedIds containing every candidate id exactly once, no extras."
    ],
    watchRegion: {
      code: req.watchRegion,
      label: watchRegionLabel(req.watchRegion),
      note: "Prefer titles realistically available to stream in this country; avoid US-only exclusives when region is not US."
    },
    onboarding: {
      moods: req.answers.moods,
      preferredType: req.answers.preferredType,
      runtime: req.answers.runtime,
      languages: req.answers.languages,
      releaseWindow: req.answers.releaseWindow,
      customYearRange: req.answers.customYearRange,
      familiarities: req.answers.familiarities,
      providers: req.answers.providers,
      hardExclusions: req.answers.hardExclusions,
      keywords: req.answers.keywords
    },
    profile: {
      genreAffinity: req.profile.genreAffinity,
      moodAffinity: req.profile.moodAffinity,
      runtimeAffinity: req.profile.runtimeAffinity,
      typeAffinity: req.profile.typeAffinity,
      languageAffinity: req.profile.languageAffinity,
      providerAffinity: req.profile.providerAffinity,
      likedIds: req.profile.likedIds,
      rejectedIds: req.profile.rejectedIds,
      seenIds: req.profile.seenIds,
      preferredType: req.profile.preferredType
    },
    history: compactHistory(req.historyHints),
    candidates: compactCandidates,
    requiredOutput: { orderedIds: compactCandidates.map((title) => title.id) }
  });
}

export function buildGeneratePrompt(req: AiGenerateRequest): string {
  return JSON.stringify({
    task: "Suggest titles the user is likely to choose now.",
    constraints: [
      `Return exactly ${req.count} suggestions if possible.`,
      "Use real well-known titles that exist in TMDB (movies and TV series).",
      "Do not include duplicates.",
      "Respect preferred type if user set one.",
      "Avoid genres or themes the user listed under hardExclusions.",
      `User watches in ${watchRegionLabel(req.watchRegion)} (${req.watchRegion}); favor titles they can plausibly access there.`
    ],
    watchRegion: req.watchRegion,
    answers: req.answers,
    profileSignals: {
      genreAffinity: req.profile.genreAffinity,
      moodAffinity: req.profile.moodAffinity,
      runtimeAffinity: req.profile.runtimeAffinity,
      typeAffinity: req.profile.typeAffinity,
      languageAffinity: req.profile.languageAffinity,
      providerAffinity: req.profile.providerAffinity,
      likedIds: req.profile.likedIds,
      rejectedIds: req.profile.rejectedIds,
      seenIds: req.profile.seenIds,
      preferredType: req.profile.preferredType,
      sessionCount: req.profile.sessionCount,
      lastChosenTitle: req.profile.lastChosenTitle
    },
    history: compactHistory(req.historyHints),
    outputShape: {
      suggestions: [{ name: "string", type: "movie|series", reason: "short reason" }]
    }
  });
}
